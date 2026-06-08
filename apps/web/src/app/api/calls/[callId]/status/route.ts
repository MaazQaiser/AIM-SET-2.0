import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callId } = await params;
  const body = (await request.json().catch(() => ({}))) as { status?: string };
  const status = body.status?.trim();
  if (!status) {
    return NextResponse.json({ error: "status is required" }, { status: 400 });
  }

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${encodeURIComponent(callId)}/status`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify({ status }),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Call status update failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
