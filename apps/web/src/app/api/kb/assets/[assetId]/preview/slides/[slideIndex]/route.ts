import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string; slideIndex: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { assetId, slideIndex } = await params;
  const secret = getInternalApiSecret();
  const res = await fetch(
    `${internalApiUrl()}/api/v1/kb/assets/${assetId}/preview/slides/${slideIndex}`,
    {
      headers: {
        ...(secret ? { "X-Internal-Secret": secret } : {}),
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    return new NextResponse("Slide not found", { status: res.status });
  }

  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store, must-revalidate",
    },
  });
}
