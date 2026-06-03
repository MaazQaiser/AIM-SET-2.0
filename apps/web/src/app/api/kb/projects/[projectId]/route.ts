import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

function headers(userId: string, orgId: string | null | undefined) {
  const secret = getInternalApiSecret();
  return {
    ...(secret ? { "X-Internal-Secret": secret } : {}),
    "x-user-id": userId,
    ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await params;
  const res = await fetch(`${internalApiUrl()}/api/v1/kb/projects/${projectId}`, {
    headers: headers(userId, orgId),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  return NextResponse.json(data, { status: res.status });
}
