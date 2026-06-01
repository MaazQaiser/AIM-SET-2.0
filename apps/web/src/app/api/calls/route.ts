import { auth } from "@/lib/api/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/v1/calls`, {
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    });

    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the API at localhost:8000. Start the Python API to load live calls." },
      { status: 503 }
    );
  }
}
