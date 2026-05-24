import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    message?: string;
    history?: { role: "user" | "assistant"; content: string }[];
    callId?: string;
    call_id?: string;
  };

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/copilot/chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({
        message,
        history: body.history ?? [],
        call_id: body.callId ?? body.call_id,
      }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Co-pilot chat failed" },
      { status: res.status }
    );
  }

  const data = (await res.json()) as {
    answer?: string;
    message_id?: string;
    citations?: {
      source_type?: string;
      source_id?: string;
      snippet?: string;
      confidence?: number;
    }[];
    actions_taken?: Record<string, unknown>[];
    call_exports?: Record<string, unknown>[];
  };

  return NextResponse.json({
    content: data.answer ?? "",
    message_id: data.message_id,
    citations: (data.citations ?? []).map((c, i) => ({
      id: c.source_id ?? `cite-${i}`,
      title: c.source_type === "transcript" ? "Transcript" : "Knowledge base",
      type: c.source_type ?? "kb_document",
      excerpt: c.snippet,
    })),
    actions_taken: data.actions_taken ?? [],
    call_exports: data.call_exports ?? [],
  });
}
