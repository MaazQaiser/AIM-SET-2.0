import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/integrations/google/sync
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Google Calendar is not connected",
      syncedAt: new Date().toISOString(),
      callsFound: 0,
      callsAdded: 0,
      callsUpdated: 0,
    },
    { status: 503 }
  );
}
