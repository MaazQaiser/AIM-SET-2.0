import { auth } from "@/lib/api/auth";
import { type NextRequest, NextResponse } from "next/server";

function tenantHeaders(userId: string, orgId: string | null | undefined) {
  return {
    "x-user-id": userId,
    ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
  };
}

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";

  const res = await fetch(`${apiUrl}/api/v1/agents/briefing?date=${encodeURIComponent(date)}`, {
    headers: tenantHeaders(userId, orgId),
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; error?: string };
    return NextResponse.json(
      { error: err.detail ?? err.error ?? "Briefing not found" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";

  const res = await fetch(
    `${apiUrl}/api/v1/agents/briefing?refresh=${refresh ? "true" : "false"}&date=${encodeURIComponent(date)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(userId, orgId),
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
