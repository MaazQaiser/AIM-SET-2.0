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

export async function POST(req: Request) {
  try {
    const headers = await internalApiHeaders();
    const body = await req.json();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      return new NextResponse(err || "Upstream error", { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
