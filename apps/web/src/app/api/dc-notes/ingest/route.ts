import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const secret = getInternalApiSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured in apps/web/.env.local" },
      { status: 503 }
    );
  }

  const body = await req.text();

  try {
    const headers = await internalApiHeaders({ "Content-Type": "application/json" });
    const res = await fetch(`${apiBaseUrl()}/dc-notes/ingest`, {
      method: "POST",
      headers,
      body,
    });

    const data = await res.json().catch(() => ({ error: "Invalid upstream response" }));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const message =
      err instanceof Error && err.message.includes("fetch failed")
        ? `Cannot reach the API at ${apiBaseUrl()}. Start it with: cd services/api && uvicorn app.main:app --reload --port 8000`
        : err instanceof Error
          ? err.message
          : "Upstream request failed";
    return NextResponse.json({ error: message, detail: message }, { status: 503 });
  }
}
