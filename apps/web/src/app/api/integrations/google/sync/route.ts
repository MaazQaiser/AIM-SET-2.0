import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/integrations/google/sync
 *
 * Manual re-sync trigger. Fetches the latest events from Google Calendar
 * and updates the DC Copilot call database.
 *
 * Called by the "Sync now" button in the settings integrations UI.
 * Returns { syncedAt, callsFound, callsAdded, callsUpdated }.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Production ─────────────────────────────────────────────────────────
  // const { accessToken, orgDomain } = await getTokensAndOrgForUser(userId);
  // const selectedCalendarIds = await getSavedCalendarSelection(userId);
  // const events = await fetchUpcomingEvents(accessToken, selectedCalendarIds, 14);
  // const calls = mapEventsToMappedCalls(events, orgDomain);
  // const { added, updated } = await upsertCalendarCalls(userId, calls);
  // return NextResponse.json({ syncedAt: new Date().toISOString(), callsFound: calls.length, callsAdded: added, callsUpdated: updated });

  // ── Mock ───────────────────────────────────────────────────────────────
  await new Promise((r) => setTimeout(r, 1200)); // simulate sync delay

  return NextResponse.json({
    syncedAt:     new Date().toISOString(),
    callsFound:   3,
    callsAdded:   1,
    callsUpdated: 2,
  });
}
