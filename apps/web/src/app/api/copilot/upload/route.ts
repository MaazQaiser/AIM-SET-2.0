import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

export const maxDuration = 60;

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

function tenantHeaders(userId: string, orgId: string | null | undefined) {
  const shared = process.env.NEXT_PUBLIC_KB_SHARED === "true";
  const tenantId = shared ? "dc-copilot-shared" : (orgId ?? userId);
  return {
    "x-user-id": userId,
    "x-tenant-id": tenantId,
    ...(shared || orgId ? { "x-clerk-org-id": tenantId } : {}),
  };
}

function appendFormField(target: FormData, key: string, value: FormDataEntryValue) {
  if (typeof value === "string") {
    target.append(key, value);
    return;
  }
  const file = value as File;
  target.append(key, file, file.name || "upload.bin");
}

/** Proxy KB file upload for Sales Co-pilot attach flow. */
export async function POST(req: NextRequest) {
  try {
    const { userId, orgId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const secret = getInternalApiSecret();
    if (!secret) {
      return NextResponse.json(
        { error: "INTERNAL_API_SECRET is not configured" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const upstream = new FormData();
    for (const [key, value] of formData.entries()) {
      appendFormField(upstream, key, value);
    }

    const res = await fetch(`${internalApiUrl()}/api/v1/kb/assets/upload`, {
      method: "POST",
      headers: {
        "X-Internal-Secret": secret,
        ...tenantHeaders(userId, orgId),
      },
      body: upstream,
    });

    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      data = { error: "Invalid upstream response", detail: text.slice(0, 500) };
    }

    if (!res.ok) {
      const detail =
        (typeof data.detail === "string" && data.detail) ||
        (typeof data.error === "string" && data.error) ||
        `Upload failed (${res.status})`;
      return NextResponse.json({ ...data, detail, error: data.error ?? "Upload failed" }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
