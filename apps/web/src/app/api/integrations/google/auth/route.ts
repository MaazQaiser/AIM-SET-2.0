import { NextResponse } from "next/server";
import { auth } from "@/lib/api/auth";
import { buildGoogleAuthUrl } from "@/lib/google-calendar";

/**
 * GET /api/integrations/google/auth
 *
 * Initiates the Google OAuth flow. Encodes the Clerk user ID into the
 * OAuth `state` parameter so we can associate the tokens to the right
 * user in the callback.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // State encodes userId + a random nonce (CSRF protection).
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ userId, nonce })).toString("base64url");

  // In production: store `nonce` in a short-lived session/redis key keyed by userId
  // so the callback can verify it.

  const authUrl = buildGoogleAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
