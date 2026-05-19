import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * POST /api/calls/[callId]/bot-chat
 * Body: { message: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const body = (await request.json()) as { message?: string };
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Production: proxy to FastAPI live-call bot endpoint.
  void callId;

  return NextResponse.json(
    { error: "Live call bot chat is not connected. Configure the live-call agent API." },
    { status: 503 }
  );
}
