import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(_request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { callId } = await params;

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${callId}/generate-brief`,
    {
      method: "POST",
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
    }
  );

  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: "Upstream error" }));
    return NextResponse.json(data, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
