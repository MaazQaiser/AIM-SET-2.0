import { auth } from "@/lib/api/auth";
import { NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string; suggestionId: string }>;
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId, suggestionId } = await params;
  const body = (await request.json()) as { status?: string };
  const status = body.status?.trim();
  if (status !== "accepted" && status !== "dismissed") {
    return NextResponse.json({ error: "status must be accepted or dismissed" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${callId}/suggestions/${suggestionId}/feedback`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json(err, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
