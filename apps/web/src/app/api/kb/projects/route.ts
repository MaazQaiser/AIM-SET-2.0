import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

function headers(userId: string, orgId: string | null | undefined) {
  const secret = getInternalApiSecret();
  const shared = process.env.NEXT_PUBLIC_KB_SHARED === "true";
  const tenantId = shared ? "dc-copilot-shared" : (orgId ?? userId);
  return {
    ...(secret ? { "X-Internal-Secret": secret } : {}),
    "x-user-id": userId,
    "x-tenant-id": tenantId,
    ...(orgId ? { "x-clerk-org-id": orgId } : {}),
  };
}

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${internalApiUrl()}/api/v1/kb/projects`, {
    headers: headers(userId, orgId),
    cache: "no-store",
  });
  const data = await res.json().catch(() => []);
  return NextResponse.json(data, { status: res.status });
}
