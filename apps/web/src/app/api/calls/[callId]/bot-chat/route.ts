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
  const body = (await request.json()) as { message?: string };
  if (!body.message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
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
      body: JSON.stringify({ message: body.message }),
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
    citations?: { id: string; title: string; type: string; excerpt?: string }[];
  };

  return NextResponse.json({
    content: data.content ?? "",
    citations: (data.citations ?? []).map((c, i) => ({
      id: c.id ?? `cite-${i}`,
      title: c.title ?? "Source",
      type: c.type ?? "transcript",
      excerpt: c.excerpt,
    })),
  });
}
