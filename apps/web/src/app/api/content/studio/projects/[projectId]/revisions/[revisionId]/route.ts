import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; revisionId: string }> }
) {
  try {
    const { projectId, revisionId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/content/studio/projects/${projectId}/revisions/${revisionId}`,
      { headers }
    );
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
