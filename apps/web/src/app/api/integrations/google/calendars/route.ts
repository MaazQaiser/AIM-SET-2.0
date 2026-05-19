import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { GoogleCalendar } from "@/types/integrations";

/**
 * GET /api/integrations/google/calendars
 *
 * Returns the user's Google calendars with their current sync selection.
 * In production: fetches the access token from the Python backend, calls
 * the Google Calendar API, and merges in the user's saved calendar
 * selection preferences.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Production: fetch token + call Google API ─────────────────────────
  // const { accessToken } = await getTokensForUser(userId);  // from Python backend
  // const calendars = await listCalendars(accessToken);
  // const savedSelection = await getSavedCalendarSelection(userId);
  // return NextResponse.json(calendars.map(c => ({ ...c, selected: savedSelection.includes(c.id) })));

  // ── Mock response ──────────────────────────────────────────────────────
  const mockCalendars: GoogleCalendar[] = [
    {
      id: "primary",
      summary: "alex@company.com",
      primary: true,
      accessRole: "owner",
      backgroundColor: "#4285F4",
      selected: true,
    },
    {
      id: "shared-sales",
      summary: "Shared Sales Calendar",
      primary: false,
      accessRole: "writer",
      backgroundColor: "#0F9D58",
      selected: true,
    },
    {
      id: "personal",
      summary: "Personal",
      primary: false,
      accessRole: "owner",
      backgroundColor: "#DB4437",
      selected: false,
    },
  ];

  return NextResponse.json({ calendars: mockCalendars });
}

/**
 * PATCH /api/integrations/google/calendars
 *
 * Updates which calendars are included in the sync.
 * Body: { selectedIds: string[] }
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as { selectedIds?: string[] };
  if (!Array.isArray(body.selectedIds)) {
    return NextResponse.json({ error: "selectedIds must be an array" }, { status: 400 });
  }

  // ── Production: persist selection to Python backend ───────────────────
  // await saveCalendarSelection(userId, body.selectedIds);

  return NextResponse.json({ ok: true, selectedIds: body.selectedIds });
}
