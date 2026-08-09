import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse } from "next/server";

const internalApiUrl = () =>
  process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

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
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const res = await fetch(`${internalApiUrl()}/api/v1/kb/assets`, {
      headers: headers(userId, orgId),
      cache: "no-store",
    });

    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Cannot reach the API at localhost:8000. Start the Python API to load KB assets." },
      { status: 503 }
    );
  }
}
