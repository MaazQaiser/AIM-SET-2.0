import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/agents/briefing`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Briefing generation failed" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
