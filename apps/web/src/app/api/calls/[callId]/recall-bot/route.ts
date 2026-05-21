import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    meetingUrl?: string;
    meeting_url?: string;
  };
  const meetingUrl = (body.meetingUrl ?? body.meeting_url ?? "").trim();
  if (!meetingUrl) {
    return NextResponse.json({ error: "Meeting URL is required" }, { status: 400 });
  }

  try {
    const parsed = new URL(meetingUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Meeting URL must be http(s)" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Meeting URL is invalid" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${encodeURIComponent(callId)}/recall-bot`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({ meeting_url: meetingUrl }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Recall bot launch failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
