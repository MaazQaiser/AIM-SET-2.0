import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { assetId } = await params;
  const secret = getInternalApiSecret();
  const res = await fetch(`${internalApiUrl()}/api/v1/kb/assets/${assetId}/file`, {
    headers: {
      ...(secret ? { "X-Internal-Secret": secret } : {}),
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return new NextResponse("File not found", { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const disposition = res.headers.get("content-disposition");
  const body = await res.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      ...(disposition ? { "Content-Disposition": disposition } : {}),
      "Cache-Control": "private, max-age=300",
    },
  });
}
