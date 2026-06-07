import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const headers = await internalApiHeaders();
    const url = new URL(req.url);
    const upstreamUrl = new URL(`${apiBaseUrl()}/api/v1/content/studio/projects/${projectId}`);
    const includeLatest = url.searchParams.get("includeLatest");
    if (includeLatest != null) {
      upstreamUrl.searchParams.set("includeLatest", includeLatest);
    }
    const res = await fetch(upstreamUrl, {
      headers,
    });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/studio/projects/${projectId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
