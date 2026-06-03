import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function POST(_req: Request, { params }: Params) {
  try {
    const headers = await internalApiHeaders();
    const { callId } = await params;
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/calls/${encodeURIComponent(callId)}/landing-page/proposal/generate`,
      { method: "POST", headers }
    );
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
