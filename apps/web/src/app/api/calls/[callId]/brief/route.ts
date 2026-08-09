import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { callId } = await params;

  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/calls/${callId}/brief`, {
      headers,
      cache: "no-store",
    });

    if (res.status === 404) {
      return NextResponse.json(null, { status: 404 });
    }
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    return new NextResponse("Upstream error", { status: 503 });
  }
}
