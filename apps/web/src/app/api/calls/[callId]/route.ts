import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(_request: Request, { params }: Params) {
  const { callId } = await params;

  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/calls/${callId}`, {
      headers,
      cache: "no-store",
    });

    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return NextResponse.json(
      { error: "Cannot reach the API at localhost:8000. Start the Python API to load this call." },
      { status: 503 }
    );
  }
}
