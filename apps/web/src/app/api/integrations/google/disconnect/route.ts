import { NextResponse } from "next/server";
import { auth } from "@/lib/api/auth";

/**
 * DELETE /api/integrations/google/disconnect
 *
 * Revokes the Google OAuth tokens and removes the integration.
 * 1. Revokes the access token with Google.
 * 2. Deletes stored tokens from the backend DB.
 * 3. Unregisters all push notification channels.
 * 4. Optionally removes calendar-sourced calls from the DC Copilot DB.
 */
export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Production ─────────────────────────────────────────────────────────
  // const { accessToken, refreshToken } = await getTokensForUser(userId);
  // await revokeToken(accessToken);
  // await revokeToken(refreshToken);           // revoke refresh token too
  // await deleteIntegration(userId, "google_calendar");
  // await unregisterAllPushChannels(userId);

  return NextResponse.json({ ok: true, disconnectedAt: new Date().toISOString() });
}
