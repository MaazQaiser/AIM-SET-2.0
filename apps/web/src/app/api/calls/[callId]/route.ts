import { auth } from "@/lib/api/auth";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { callId } = await params;

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls/${callId}`,
    {
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
  const data = await res.json();
  return NextResponse.json(data);
}
