// ── Integration connection status ─────────────────────────────────────────
export type IntegrationProvider = "google_calendar" | "microsoft_calendar" | "hubspot" | "salesforce" | "slack";
export type ConnectionStatus = "connected" | "disconnected" | "error" | "syncing";

export interface IntegrationConnection {
  provider: IntegrationProvider;
  status: ConnectionStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  errorMessage?: string;
  scopes?: string[];
  connectedEmail?: string;
}

// ── Google Calendar specific ───────────────────────────────────────────────
export interface GoogleCalendar {
  id: string;
  summary: string;              // display name
  primary: boolean;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  backgroundColor?: string;
  selected: boolean;            // user has opted in to sync this calendar
}

export interface GoogleAttendee {
  email: string;
  displayName?: string;
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction";
  organizer?: boolean;
  self?: boolean;               // is this the authenticated user
}

export interface GoogleCalendarEvent {
  id: string;
  calendarId: string;
  summary: string;              // event title
  description?: string;
  location?: string;
  htmlLink: string;
  start: { dateTime: string; timeZone?: string };
  end:   { dateTime: string; timeZone?: string };
  attendees: GoogleAttendee[];
  hangoutLink?: string;         // Google Meet URL
  conferenceData?: {
    entryPoints?: { entryPointType: string; uri: string; label?: string }[];
  };
  organizer: { email: string; displayName?: string };
  status: "confirmed" | "tentative" | "cancelled";
  updated: string;
}

// ── Mapped call from Google Calendar event ────────────────────────────────
export interface CalendarMappedCall {
  eventId: string;
  calendarId: string;
  title: string;
  accountName: string;          // derived: organizer domain or event title
  scheduledAt: string;
  endAt: string;
  durationMinutes: number;
  meetingUrl?: string;          // Google Meet / Zoom link
  attendees: MappedAttendee[];
  isExternal: boolean;          // has at least one external (non-org) attendee
  source: "google_calendar";
  rawEvent: GoogleCalendarEvent;
}

export interface MappedAttendee {
  email: string;
  name?: string;
  isExternal: boolean;
  responseStatus: GoogleAttendee["responseStatus"];
}

// ── Sync state ─────────────────────────────────────────────────────────────
export interface CalendarSyncState {
  isConnected: boolean;
  isSyncing: boolean;
  calendars: GoogleCalendar[];
  selectedCalendarIds: string[];
  lastSyncAt?: string;
  nextSyncAt?: string;
  upcomingEventCount: number;
  errorMessage?: string;
}

// ── Webhook push notification ──────────────────────────────────────────────
export interface GooglePushNotification {
  channelId: string;
  channelToken: string;
  resourceId: string;
  resourceState: "sync" | "exists" | "not_exists";
  resourceUri: string;
}
