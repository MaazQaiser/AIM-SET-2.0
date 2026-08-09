import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse } from "next/server";

export async function GET() {
  const secret = getInternalApiSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured in apps/web/.env.local" },
      { status: 503 }
    );
  }

  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/dc-notes`, {
      headers,
      cache: "no-store",
    });

    const data = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      err instanceof Error && err.message.includes("fetch failed")
        ? `Cannot reach the API at ${apiBaseUrl()}. Start the Python API on port 8000.`
        : err instanceof Error
          ? err.message
          : "Upstream request failed";
    return NextResponse.json({ error: message, detail: message }, { status: 503 });
  }
}
