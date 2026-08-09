import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/calls`, {
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
      { error: "Cannot reach the API at localhost:8000. Start the Python API to load live calls." },
      { status: 503 }
    );
  }
}
