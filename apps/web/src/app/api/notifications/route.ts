import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const headers = await internalApiHeaders();
    const unread = req.nextUrl.searchParams.get("unread_only") === "true";
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/notifications${unread ? "?unread_only=true" : ""}`,
      { headers, cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json([]);
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
