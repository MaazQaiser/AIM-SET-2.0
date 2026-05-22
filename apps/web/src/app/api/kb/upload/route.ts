import { auth } from "@/lib/api/auth";
import { getInternalApiSecret } from "@/lib/public-env";
import { NextResponse, type NextRequest } from "next/server";

/** File transfer to Railway; ingest runs async on the API after upload returns. */
export const maxDuration = 60;

const internalApiUrl = () => process.env.INTERNAL_API_URL ?? process.env.API_URL ?? "http://localhost:8000";

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
              ? "File upload was blocked or truncated by the server proxy. Try a smaller file or restart the dev server after updating next.config."
              : message,
        },
        { status: 400 }
      );
    }

    const upstream = new FormData();
    for (const [key, value] of formData.entries()) {
      upstream.append(key, value);
    }

    const upstreamUrl = `${internalApiUrl()}/api/v1/kb/assets/upload`;
    let res: Response;
    try {
      res = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          "X-Internal-Secret": secret,
          "x-user-id": userId,
          ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
        },
        body: upstream,
      });
    } catch {
      return NextResponse.json({ error: "API unreachable", detail: "Upstream fetch failed" }, { status: 502 });
    }

    const upstreamText = await res.text();
    let data: Record<string, unknown>;
    try {
      data = upstreamText ? (JSON.parse(upstreamText) as Record<string, unknown>) : {};
    } catch {
      data = { error: "Invalid upstream response", detail: upstreamText.slice(0, 200) };
    }
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload handler failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
