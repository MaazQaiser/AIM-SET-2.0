import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const headers = await internalApiHeaders();
    const body = await req.json();

    const upstream = await fetch(
      `${apiBaseUrl()}/api/v1/content/studio/projects/${projectId}/chat`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!upstream.ok) {
      const err = await upstream.text();
      return new NextResponse(err || "Upstream error", { status: upstream.status });
    }

    // Pass the SSE stream through to the browser
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
