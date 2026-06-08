import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ assetName: string }> }
) {
  try {
    const { assetName } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/content/templates/parent/assets/${encodeURIComponent(assetName)}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) {
      return new NextResponse("Not found", { status: res.status });
    }
    const bytes = await res.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
