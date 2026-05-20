import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET() {
  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/studio/projects`, { headers });
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
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/studio/projects`, {
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
