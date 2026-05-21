import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { jobId } = await params;
  const secret = getInternalApiSecret();

  const res = await fetch(`${internalApiUrl()}/api/v1/kb/ingest-jobs/${jobId}`, {
    headers: {
      ...(secret ? { "X-Internal-Secret": secret } : {}),
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({ error: "Invalid upstream response" }));
  return NextResponse.json(data, { status: res.status });
}
