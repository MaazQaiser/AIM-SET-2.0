import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${encodeURIComponent(callId)}/poll-transcript`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string };
    return NextResponse.json(
      { error: err.detail ?? "Poll failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
