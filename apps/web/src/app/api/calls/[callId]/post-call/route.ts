import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { callId } = await params;

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${encodeURIComponent(callId)}/post-call`,
    {
      method: "POST",
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "Upstream error");
    return NextResponse.json({ error: detail }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
