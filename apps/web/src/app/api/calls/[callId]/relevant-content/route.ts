import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

export async function GET(request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { callId } = await params;
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const apiUrl = process.env.API_URL ?? "http://localhost:8000";

  const res = await fetch(
    `${apiUrl}/api/v1/calls/${callId}/relevant-content?refresh=${refresh ? "true" : "false"}`,
    {
      headers: {
        "x-user-id": userId,
        ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: detail || "Failed to load relevant content" },
      { status: res.status }
    );
  }

  return NextResponse.json(await res.json());
}
