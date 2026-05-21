import { NextResponse } from "next/server";
import { getApiUrl, getInternalApiSecret } from "@/lib/public-env";

/** Public check: Vercel INTERNAL_API_SECRET matches Railway (no secret values returned). */
export async function GET() {
  const secret = getInternalApiSecret();
  if (!secret) {
    return NextResponse.json({
      ok: false,
      reason: "INTERNAL_API_SECRET is not set on Vercel",
      secretLength: 0,
    });
  }

  const apiUrl = getApiUrl();
  try {
    const res = await fetch(`${apiUrl}/dc-notes`, {
      headers: {
        "X-Internal-Secret": secret,
        "x-user-id": "health-check",
        "x-tenant-id": "health-check",
      },
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json({
      ok: res.status === 200,
      upstreamStatus: res.status,
      apiUrlHost: (() => {
        try {
          return new URL(apiUrl).host;
        } catch {
          return apiUrl;
        }
      })(),
      secretLength: secret.length,
      detail: res.status === 401 ? "Invalid internal secret — must match Railway INTERNAL_SECRET exactly" : body.detail,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      reason: err instanceof Error ? err.message : "Cannot reach API",
      secretLength: secret.length,
    });
  }
}
