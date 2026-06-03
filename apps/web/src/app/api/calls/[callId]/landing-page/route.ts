import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const headers = await internalApiHeaders();
    const { callId } = await params;
    const res = await fetch(`${apiBaseUrl()}/api/v1/calls/${encodeURIComponent(callId)}/landing-page`, {
      headers,
      cache: "no-store",
    });
    if (res.status === 404) return NextResponse.json(null, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const headers = await internalApiHeaders();
    const { callId } = await params;
    const body = await req.json();
    const res = await fetch(`${apiBaseUrl()}/api/v1/calls/${encodeURIComponent(callId)}/landing-page`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
