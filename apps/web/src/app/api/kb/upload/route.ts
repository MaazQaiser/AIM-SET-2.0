import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

/** File transfer to Railway; ingest runs async on the API after upload returns. */
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

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: "Failed to read upload",
          detail:
            message.includes("FormData") || message.includes("formData")
              ? "File upload was blocked or truncated by the server proxy. Try a smaller file or restart the dev server."
              : message,
        },
        { status: 400 }
      );
    }

    const upstream = new FormData();
    for (const [key, value] of formData.entries()) {
      appendFormField(upstream, key, value);
    }

    const upstreamUrl = `${internalApiUrl()}/api/v1/kb/assets/upload`;
    let res: Response;
    try {
      res = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "X-Internal-Secret": secret,
          ...tenantHeaders(userId, orgId),
        },
        body: upstream,
      });
    } catch (err) {
      return NextResponse.json(
        {
          error: "API unreachable",
          detail: err instanceof Error ? err.message : "Upstream fetch failed",
        },
        { status: 502 }
      );
    }

    const upstreamText = await res.text();
    let data: Record<string, unknown>;
    try {
      data = upstreamText ? (JSON.parse(upstreamText) as Record<string, unknown>) : {};
    } catch {
      data = { error: "Invalid upstream response", detail: upstreamText.slice(0, 500) };
    }

    if (!res.ok) {
      const detail =
        (typeof data.detail === "string" && data.detail) ||
        (typeof data.error === "string" && data.error) ||
        upstreamText.slice(0, 300) ||
        `Upload failed (${res.status})`;
      return NextResponse.json({ ...data, detail, error: data.error ?? "Upload failed" }, { status: res.status });
    }

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload handler failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
