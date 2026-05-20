import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET(req: Request) {
  try {
    const headers = await internalApiHeaders();
    const url = new URL(req.url);
    const artifactType = url.searchParams.get("artifactType");
    const qs = artifactType ? `?artifact_type=${encodeURIComponent(artifactType)}` : "";
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates${qs}`, { headers });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
