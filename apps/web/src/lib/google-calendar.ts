/**
 * Google Calendar BFF utilities.
 *
 * All token exchange and API calls live server-side (API routes / Server Components).
 * The browser never receives raw OAuth tokens — the BFF returns mapped, safe payloads.
 *
 * Flow:
 *   1. /api/integrations/google/auth      → build OAuth URL → redirect
 *   2. /api/integrations/google/callback  → exchange code → store tokens
 *   3. /api/integrations/google/events    → fetch events → map to CalendarMappedCall[]
 *   4. /api/integrations/google/webhook   → push notification → invalidate cache
 */

import type {
  GoogleCalendarEvent,
  GoogleCalendar,
  GoogleAttendee,
  CalendarMappedCall,
  MappedAttendee,
} from "@/types/integrations";

// ── OAuth config ────────────────────────────────────────────────────────────
const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

// Minimum required scopes — read-only calendar access
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "openid",
  "email",
  "profile",
];

// ── OAuth URL builder ───────────────────────────────────────────────────────
export function buildGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI ?? "",
    response_type: "code",
    scope:         REQUIRED_SCOPES.join(" "),
    access_type:   "offline",   // get refresh_token
    prompt:        "consent",   // force refresh_token on every connect
    state,
  });
  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

// ── Token exchange ──────────────────────────────────────────────────────────
export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
}

export async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI ?? "",
      grant_type:    "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) throw new Error("Token refresh failed");
  return res.json() as Promise<GoogleTokenResponse>;
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
}

// ── Calendar API helpers ────────────────────────────────────────────────────
async function googleFetch<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${GOOGLE_CALENDAR_API}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 60 },   // Next.js ISR: cache 60s server-side
  });

  if (res.status === 401) throw new Error("GOOGLE_TOKEN_EXPIRED");
  if (!res.ok) throw new Error(`Google API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// List user's calendars
export async function listCalendars(accessToken: string): Promise<GoogleCalendar[]> {
  const data = await googleFetch<{ items: GoogleCalendar[] }>(
    "/users/me/calendarList",
    accessToken
  );
  return data.items ?? [];
}

// Fetch upcoming events from selected calendars
export async function fetchUpcomingEvents(
  accessToken: string,
  calendarIds: string[],
  daysAhead = 14
): Promise<GoogleCalendarEvent[]> {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + daysAhead * 86_400_000).toISOString();

  const allEvents: GoogleCalendarEvent[] = [];

  await Promise.all(
    calendarIds.map(async (calendarId) => {
      const data = await googleFetch<{ items: GoogleCalendarEvent[] }>(
        `/calendars/${encodeURIComponent(calendarId)}/events`,
        accessToken,
        {
          timeMin:      now,
          timeMax:      future,
          singleEvents: "true",
          orderBy:      "startTime",
          maxResults:   "50",
        }
      );
      allEvents.push(
        ...(data.items ?? []).map((ev) => ({ ...ev, calendarId }))
      );
    })
  );

  return allEvents
    .filter((ev) => ev.status !== "cancelled")
    .sort(
      (a, b) =>
        new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime()
    );
}

// ── Register push notification channel ─────────────────────────────────────
export async function registerPushChannel(
  accessToken: string,
  calendarId: string,
  webhookUrl: string,
  channelId: string
): Promise<{ id: string; resourceId: string; expiration: string }> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id:      channelId,
        type:    "web_hook",
        address: webhookUrl,
        token:   process.env.GOOGLE_WEBHOOK_SECRET ?? "",
        params:  { ttl: "604800" }, // 7 days — must be renewed
      }),
    }
  );
  if (!res.ok) throw new Error("Failed to register push channel");
  return res.json();
}

// ── Event → CalendarMappedCall mapper ──────────────────────────────────────
function extractMeetUrl(event: GoogleCalendarEvent): string | undefined {
  if (event.hangoutLink) return event.hangoutLink;
  return event.conferenceData?.entryPoints?.find(
    (ep) => ep.entryPointType === "video"
  )?.uri;
}

function inferAccountName(event: GoogleCalendarEvent, orgDomain?: string): string {
  // Use the first external attendee's company domain as the account name,
  // falling back to the event title.
  if (!orgDomain) return event.summary;

  const external = event.attendees?.find(
    (a) => !a.self && !a.email.endsWith(`@${orgDomain}`)
  );
  if (external?.displayName) {
    const parts = external.displayName.split(" ");
    if (parts.length >= 2) return parts.slice(1).join(" ") || event.summary;
  }
  const externalDomain = external?.email.split("@")[1]?.split(".")[0];
  if (externalDomain) {
    return externalDomain.charAt(0).toUpperCase() + externalDomain.slice(1);
  }
  return event.summary;
}

function mapAttendee(a: GoogleAttendee, orgDomain?: string): MappedAttendee {
  const domain = a.email.split("@")[1] ?? "";
  return {
    email:          a.email,
    name:           a.displayName,
    isExternal:     orgDomain ? !a.email.endsWith(`@${orgDomain}`) : false,
    responseStatus: a.responseStatus,
  };
}

export function mapEventToCall(
  event: GoogleCalendarEvent,
  orgDomain?: string
): CalendarMappedCall {
  const start = new Date(event.start.dateTime);
  const end   = new Date(event.end.dateTime);
  const duration = Math.round((end.getTime() - start.getTime()) / 60_000);

  const attendees = (event.attendees ?? []).map((a) => mapAttendee(a, orgDomain));
  const isExternal = attendees.some((a) => a.isExternal);

  return {
    eventId:         event.id,
    calendarId:      event.calendarId,
    title:           event.summary,
    accountName:     inferAccountName(event, orgDomain),
    scheduledAt:     event.start.dateTime,
    endAt:           event.end.dateTime,
    durationMinutes: duration,
    meetingUrl:      extractMeetUrl(event),
    attendees,
    isExternal,
    source:          "google_calendar",
    rawEvent:        event,
  };
}

export function mapEventsToMappedCalls(
  events: GoogleCalendarEvent[],
  orgDomain?: string
): CalendarMappedCall[] {
  return events
    .filter((ev) => {
      const attendees = ev.attendees ?? [];
      if (!orgDomain) return true;
      // Only include events with at least one external attendee (actual client calls)
      return attendees.some((a) => !a.self && !a.email.endsWith(`@${orgDomain}`));
    })
    .map((ev) => mapEventToCall(ev, orgDomain));
}
