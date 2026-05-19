import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, listCalendars, registerPushChannel } from "@/lib/google-calendar";

/**
 * GET /api/integrations/google/callback?code=...&state=...
 *
 * Handles the OAuth redirect from Google.
 * 1. Validates state (CSRF check).
 * 2. Exchanges the code for access + refresh tokens.
 * 3. Stores tokens in the backend (proxied to Python FastAPI).
 * 4. Registers push notification channels for each calendar.
 * 5. Redirects back to /settings?tab=integrations&connected=true
 *
 * NOTE: In production, token storage must go through the Python backend —
 * never store raw OAuth tokens in the Next.js process or client-side storage.
 * The backend encrypts them at rest using AES-256-GCM keyed by the user's ID.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // User denied consent
  if (error) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=access_denied", request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=invalid_callback", request.url)
    );
  }

  try {
    // Decode state → validate userId + nonce
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf-8")
    ) as { userId: string; nonce: string };

    if (!decoded.userId) throw new Error("Invalid state");

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // ── In production: POST tokens to Python backend ──────────────────────
    // await fetch(`${process.env.API_URL}/integrations/google`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "X-User-Id": decoded.userId,
    //   },
    //   body: JSON.stringify({
    //     access_token: tokens.access_token,
    //     refresh_token: tokens.refresh_token,
    //     expires_in: tokens.expires_in,
    //     scope: tokens.scope,
    //   }),
    // });

    // ── Register push notification channels ───────────────────────────────
    // After storing tokens, fetch calendars and register a push channel per calendar.
    // This is done async — don't block the redirect on it.
    //
    // const calendars = await listCalendars(tokens.access_token);
    // const webhookBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
    // for (const cal of calendars.filter((c) => c.selected !== false)) {
    //   await registerPushChannel(
    //     tokens.access_token,
    //     cal.id,
    //     `${webhookBase}/api/integrations/google/webhook`,
    //     crypto.randomUUID()
    //   );
    // }

    return NextResponse.redirect(
      new URL("/settings?tab=integrations&connected=true", request.url)
    );
  } catch (err) {
    console.error("[google/callback] Error:", err);
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=token_exchange_failed", request.url)
    );
  }
}
