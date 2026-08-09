import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";

const SHARED_TENANT = "dc-copilot-shared";

/** When NEXT_PUBLIC_KB_SHARED is on, all BFF → API traffic uses the shared Supabase tenant. */
export function resolveTenantId(userId: string, orgId: string | null | undefined): string {
  if (process.env.NEXT_PUBLIC_KB_SHARED === "true") {
    return SHARED_TENANT;
  }
  return orgId ?? userId;
}

export async function internalApiHeaders(
  extra?: HeadersInit
): Promise<Record<string, string>> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const tenantId = resolveTenantId(userId, orgId);
  const secret = getInternalApiSecret();

  return {
    "x-user-id": userId,
    "x-tenant-id": tenantId,
    ...(orgId ? { "x-clerk-org-id": orgId } : {}),
    ...(secret ? { "X-Internal-Secret": secret } : {}),
    ...(extra as Record<string, string> | undefined),
  };
}

export function apiBaseUrl(): string {
  return process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";
}
