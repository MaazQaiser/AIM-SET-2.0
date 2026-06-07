import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

type CopilotFeedbackBody = {
  feedback_id?: string;
  message_id?: string;
  rating?: string;
  comment?: string;
  response?: string;
  surface?: string;
  call_id?: string | null;
  created_at?: string;
};

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as CopilotFeedbackBody;
  const rating = body.rating?.trim();
  const messageId = body.message_id?.trim();

  if (!messageId) {
    return NextResponse.json({ error: "message_id is required" }, { status: 400 });
  }
  if (rating !== "up" && rating !== "down") {
    return NextResponse.json({ error: "rating must be up or down" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/copilot/feedback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId
          ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId }
          : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({
        feedback_id: body.feedback_id,
        message_id: messageId,
        rating,
        comment: body.comment ?? "",
        response: body.response ?? "",
        surface: body.surface ?? "global",
        call_id: body.call_id ?? undefined,
        created_at: body.created_at,
      }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Feedback could not be saved" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
