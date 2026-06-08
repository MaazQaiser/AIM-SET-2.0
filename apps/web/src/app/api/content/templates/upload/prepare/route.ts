import { createHmac } from "node:crypto";
import { auth } from "@/lib/api/auth";
import { getInternalApiSecret, getPublicApiUrl } from "@/lib/public-env";
import { NextResponse } from "next/server";

const TEMPLATE_UPLOAD_TOKEN_SCOPE = "content-template-upload";
const TOKEN_TTL_SECONDS = 30 * 60;

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString("base64url");
}

function sign(payloadSegment: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadSegment).digest("base64url");
}

export async function POST() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const secret = getInternalApiSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "INTERNAL_API_SECRET is not configured" },
      { status: 503 }
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    scope: TEMPLATE_UPLOAD_TOKEN_SCOPE,
    userId,
    tenantId: orgId ?? userId,
    clerkOrgId: orgId ?? null,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const payloadSegment = base64url(JSON.stringify(payload));
  const token = `${payloadSegment}.${sign(payloadSegment, secret)}`;

  const apiBase = getPublicApiUrl();
  const templateApiBase = `${apiBase}/api/v1/content/templates`;
  return NextResponse.json({
    uploadUrl: `${templateApiBase}/upload/direct`,
    parentAssetUploadUrl: `${templateApiBase}/parent/assets/direct`,
    parentSaveUrl: `${templateApiBase}/parent/direct`,
    templateCreateUrl: `${templateApiBase}/direct`,
    templateApiBase,
    token,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  });
}
