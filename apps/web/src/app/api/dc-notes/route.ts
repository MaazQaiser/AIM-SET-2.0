import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured" },
      { status: 503 }
    );
  }

  const { orgId } = await auth();

  const res = await fetch(`${internalApiUrl()}/dc-notes`, {
    headers: {
      "X-Internal-Secret": secret,
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({ error: "Invalid upstream response" }));
  return NextResponse.json(data, { status: res.status });
}
