import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const body = (await request.json()) as {
    text?: string;
    speaker_id?: string;
    speaker_role?: string;
    offset_seconds?: number;
    provider_event_id?: string;
  };

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const tenant = orgId ?? userId;
  const qs = new URLSearchParams({
    call_id: callId,
    tenant_id: tenant,
    user_id: userId,
  });

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/webhooks/recall/demo-segment?${qs}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: body.text,
        speaker_id: body.speaker_id ?? "demo",
        speaker_role: body.speaker_role ?? "customer",
        offset_seconds: body.offset_seconds ?? 0,
        provider_event_id: body.provider_event_id,
      }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Demo segment failed" },
      { status: res.status }
    );
  }

  const data = await res.json();
  return NextResponse.json(data);
}
