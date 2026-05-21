import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/api/auth";

/**
 * GET /api/integrations/google/events?days=14
 *
 * Returns upcoming calendar events mapped to calls when Google Calendar is connected.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "14", 10), 60);

  // Production: retrieve OAuth token, call Google Calendar API, map events.
  void days;

  return NextResponse.json({
    calls: [],
    totalEvents: 0,
    syncedAt: new Date().toISOString(),
    source: "disconnected",
  });
}
