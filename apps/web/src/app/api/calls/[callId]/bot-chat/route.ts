import { auth } from "@/lib/api/auth";
import { buildSimpleGreetingResponse } from "@/lib/copilot/simple-greeting-response";
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
  const body = (await request.json()) as {
    message?: string;
    mode?: "direct" | "group";
    sender_name?: string;
    sender_role?: string;
    context?: Record<string, unknown>;
  };
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const mode = body.mode === "direct" ? "direct" : "group";
  const message = body.message.trim();
  const surface =
    body.context?.surface === "live_dc" ||
    body.context?.surface === "pre_dc" ||
    body.context?.surface === "post_dc"
      ? body.context.surface
      : "live_dc";
  const greetingResponse = buildSimpleGreetingResponse(message, surface);
  if (greetingResponse) {
    return NextResponse.json(greetingResponse);
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${callId}/bot-chat`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({
        message,
        mode,
        sender_name: body.sender_name,
        sender_role: body.sender_role,
        context: body.context ?? {},
      }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Bot chat failed" },
      { status: res.status }
    );
  }

  const data = (await res.json()) as {
    content?: string;
    citations?: {
      id?: string;
      title?: string;
      type?: string;
      excerpt?: string;
      source_type?: string;
      source_id?: string;
      snippet?: string;
      confidence?: number;
    }[];
    actions_taken?: Record<string, unknown>[];
    call_exports?: Record<string, unknown>[];
    suggestions?: string[];
    confidence?: number;
    missing_evidence?: string[];
  };

  const messageId =
    (data as { message_id?: string }).message_id ??
    (data as { envelope?: { trace_id?: string } }).envelope?.trace_id;

  return NextResponse.json({
    content: data.content ?? "",
    message_id: messageId,
    citations: (data.citations ?? []).map((c, i) => ({
      id: `${c.id ?? c.source_id ?? "cite"}-${i}`,
      title:
        c.title ??
        (c.source_type === "transcript"
          ? "Transcript"
          : c.source_type === "call_brief"
            ? "Call brief"
            : c.source_type === "post_call_review"
              ? "Post-call review"
              : c.source_type === "call_record"
                ? "Call record"
                : "Knowledge base"),
      type: c.type ?? c.source_type ?? "transcript",
      excerpt: c.excerpt ?? c.snippet,
    })),
    actions_taken: data.actions_taken ?? [],
    call_exports: data.call_exports ?? [],
    suggestions: data.suggestions ?? [],
    confidence: data.confidence ?? 0,
    missing_evidence: data.missing_evidence ?? [],
  });
}
