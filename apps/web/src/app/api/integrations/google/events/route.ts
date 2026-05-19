import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { mapEventsToMappedCalls } from "@/lib/google-calendar";
import type { GoogleCalendarEvent } from "@/types/integrations";

/**
 * GET /api/integrations/google/events?days=14
 *
 * Returns upcoming calendar events mapped to CalendarMappedCall objects.
 * Only returns events with external (non-org) attendees — i.e. real client calls.
 *
 * In production:
 *  1. Retrieve access token from Python backend (refresh if expired).
 *  2. Call Google Calendar API.
 *  3. Map events through mapEventsToMappedCalls().
 *  4. Merge with any manually-created calls in the DC Copilot DB.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14", 10), 60);

  // ── Production flow ────────────────────────────────────────────────────
  // const { accessToken, orgDomain } = await getTokensAndOrgForUser(userId);
  // const selectedCalendarIds = await getSavedCalendarSelection(userId);
  // const rawEvents = await fetchUpcomingEvents(accessToken, selectedCalendarIds, days);
  // const calls = mapEventsToMappedCalls(rawEvents, orgDomain);
  // return NextResponse.json({ calls, syncedAt: new Date().toISOString() });

  // ── Mock: realistic calendar events ───────────────────────────────────
  const ORG_DOMAIN = "company.com";
  const now = Date.now();

  const MOCK_EVENTS: GoogleCalendarEvent[] = [
    {
      id: "gcal-evt-001",
      calendarId: "primary",
      summary: "Discovery Call — Meridian Trust",
      description: "Initial discovery call with Meridian Trust compliance team.",
      start: { dateTime: new Date(now + 2 * 3600_000).toISOString() },
      end:   { dateTime: new Date(now + 3 * 3600_000).toISOString() },
      attendees: [
        { email: "alex@company.com",       displayName: "Alex Chen",        responseStatus: "accepted", self: true },
        { email: "eleanor@meridiants.com",  displayName: "Eleanor Martin",   responseStatus: "accepted" },
        { email: "priscilla@meridiants.com",displayName: "Priscilla Chen",   responseStatus: "tentative" },
      ],
      organizer:    { email: "alex@company.com", displayName: "Alex Chen" },
      htmlLink:     "https://calendar.google.com/event?id=gcal-evt-001",
      hangoutLink:  "https://meet.google.com/abc-defg-hij",
      status:       "confirmed",
      updated:      new Date().toISOString(),
    },
    {
      id: "gcal-evt-002",
      calendarId: "shared-sales",
      summary: "NovaTech Systems — Technical Deep Dive",
      description: "45-min technical session with IT team.",
      start: { dateTime: new Date(now + 26 * 3600_000).toISOString() },
      end:   { dateTime: new Date(now + 27.5 * 3600_000).toISOString() },
      attendees: [
        { email: "alex@company.com",   displayName: "Alex Chen",      responseStatus: "accepted", self: true },
        { email: "sam@company.com",    displayName: "Sam Kim (SE)",   responseStatus: "accepted" },
        { email: "james@novatech.io",  displayName: "James Thornton", responseStatus: "accepted" },
        { email: "marcus@novatech.io", displayName: "Marcus Webb",    responseStatus: "tentative" },
      ],
      organizer:   { email: "alex@company.com", displayName: "Alex Chen" },
      htmlLink:    "https://calendar.google.com/event?id=gcal-evt-002",
      conferenceData: {
        entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/123456789", label: "Join Zoom Meeting" }],
      },
      status:  "confirmed",
      updated: new Date().toISOString(),
    },
    {
      id: "gcal-evt-003",
      calendarId: "primary",
      summary: "Helios Analytics — Proposal Review",
      description: "Presenting the proposal to the Helios team.",
      start: { dateTime: new Date(now + 50 * 3600_000).toISOString() },
      end:   { dateTime: new Date(now + 51 * 3600_000).toISOString() },
      attendees: [
        { email: "alex@company.com",     displayName: "Alex Chen",      responseStatus: "accepted", self: true },
        { email: "sarah@company.com",    displayName: "Sarah Mendes",   responseStatus: "accepted" },
        { email: "diana@heliostech.com", displayName: "Diana Lowe",     responseStatus: "accepted" },
        { email: "rob@heliostech.com",   displayName: "Rob Patel",      responseStatus: "needsAction" },
      ],
      organizer:   { email: "diana@heliostech.com", displayName: "Diana Lowe" },
      htmlLink:    "https://calendar.google.com/event?id=gcal-evt-003",
      hangoutLink: "https://meet.google.com/xyz-abcd-efg",
      status:  "confirmed",
      updated: new Date().toISOString(),
    },
  ];

  const calls = mapEventsToMappedCalls(MOCK_EVENTS, ORG_DOMAIN);

  return NextResponse.json({
    calls,
    totalEvents: MOCK_EVENTS.length,
    syncedAt: new Date().toISOString(),
    source: "mock",
  });
}
