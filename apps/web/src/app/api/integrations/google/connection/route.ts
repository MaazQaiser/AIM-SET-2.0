import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/integrations/google/connection
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    isConnected: false,
    connectedEmail: undefined,
    lastSyncAt: undefined,
  });
}
