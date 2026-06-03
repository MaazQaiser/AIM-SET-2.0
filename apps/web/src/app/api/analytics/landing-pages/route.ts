import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/analytics/landing-pages`, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
