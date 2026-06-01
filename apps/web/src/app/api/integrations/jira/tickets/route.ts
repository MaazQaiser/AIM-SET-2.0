import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const res = await fetch(
    `${process.env.API_URL ?? "http://localhost:8000"}/api/v1/integrations/jira/tickets`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let upstream: { detail?: string; error?: string } | null = null;
    try {
      upstream = raw ? (JSON.parse(raw) as { detail?: string; error?: string }) : null;
    } catch {
      upstream = null;
    }
    const detail =
      typeof upstream?.detail === "string"
        ? upstream.detail
        : typeof upstream?.error === "string"
          ? upstream.error
          : raw || "Upstream error";
    return NextResponse.json({ error: detail }, { status: res.status });
  }
  return NextResponse.json(await res.json());
}
