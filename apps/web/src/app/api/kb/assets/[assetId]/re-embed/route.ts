import { auth } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ assetId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetId } = await params;
  const secret = process.env.INTERNAL_API_SECRET;
  const res = await fetch(`${internalApiUrl()}/api/v1/kb/assets/${assetId}/re-embed`, {
    method: "POST",
    headers: {
      ...(secret ? { "X-Internal-Secret": secret } : {}),
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
