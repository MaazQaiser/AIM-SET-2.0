import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { callId } = await params;

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${callId}/brief`,
    {
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    }
  );

  if (res.status === 404) {
    return NextResponse.json(null, { status: 404 });
  }
  if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
  return NextResponse.json(await res.json());
}
