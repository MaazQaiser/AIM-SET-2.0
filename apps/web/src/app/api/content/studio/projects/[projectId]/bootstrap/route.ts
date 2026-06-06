import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/content/studio/projects/${projectId}/bootstrap`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return new NextResponse(err || "Upstream error", { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
