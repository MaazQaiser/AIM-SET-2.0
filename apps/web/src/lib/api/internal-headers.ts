import { auth } from "@/lib/api/auth";

export async function internalApiHeaders(): Promise<HeadersInit> {
  const { userId, orgId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return {
    "x-user-id": userId,
    ...(orgId
      ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId }
      : { "x-tenant-id": userId }),
  };
}

export function apiBaseUrl(): string {
  return process.env.API_URL ?? "http://localhost:8000";
}
