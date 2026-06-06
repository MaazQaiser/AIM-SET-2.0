import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET() {
  try {
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/gaps`, { headers });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    const gaps = await res.json();
    const mapped = (gaps as Array<Record<string, unknown>>).map((gap) => ({
      id: gap.id,
      gapKey: gap.gapKey,
      topic: gap.name,
      sourcedFrom: gap.source === "pre_dc" ? "Pre-DC workflow" : "Post-DC wrap-up",
      callId: gap.callId,
      studioProjectId: gap.studioProjectId,
      kbAssetId: gap.kbAssetId,
      sourcePath: gap.sourcePath,
      reason: gap.reason,
      neededFor: gap.neededFor,
      artifactType: gap.artifactType,
      workflowStatus: gap.status,
      context: gap.context,
      status:
        gap.status === "in_progress"
          ? "draft"
          : gap.status === "open"
            ? "pending-review"
            : gap.status === "resolved"
              ? "approved"
              : "pending-review",
      draftType:
        String(gap.artifactType || "deck").includes("one")
          ? "one-pager"
          : String(gap.artifactType || "deck").includes("case")
            ? "case-study"
            : "deck",
    }));
    return NextResponse.json(mapped);
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
