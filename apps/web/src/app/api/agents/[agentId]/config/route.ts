import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

const UPSTREAM_TIMEOUT_MS = 10_000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/agents/${agentId}/config`, {
      headers,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: detail || "Upstream error" },
        { status: res.status }
      );
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reach API";
    const isTimeout = message.includes("timeout") || message.includes("aborted");
    return NextResponse.json(
      {
        error: isTimeout
          ? `API did not respond in time. Ensure the backend is running at ${apiBaseUrl()}`
          : message,
      },
      { status: isTimeout ? 504 : 401 }
    );
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await req.json();
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/agents/${agentId}/config`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ config: body }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: detail || "Upstream error" }, { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reach API";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
