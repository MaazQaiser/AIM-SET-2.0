import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const headers = await internalApiHeaders();
    const { callId } = await params;
    const body = await req.json();
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/calls/${encodeURIComponent(callId)}/landing-page/publish`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
