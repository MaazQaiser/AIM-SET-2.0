import { auth } from "@/lib/api/auth";
import { NextResponse } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured in apps/web/.env.local" },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${internalApiUrl()}/dc-notes`, {
      headers: {
        "X-Internal-Secret": secret,
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message =
      err instanceof Error && err.message.includes("fetch failed")
        ? `Cannot reach the API at ${internalApiUrl()}. Start the Python API on port 8000.`
        : err instanceof Error
          ? err.message
          : "Upstream request failed";
    return NextResponse.json({ error: message, detail: message }, { status: 503 });
  }
}
