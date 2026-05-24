import { type NextRequest, NextResponse } from "next/server";

/**
 * POST /api/integrations/google/webhook
 *
 * Receives Google Calendar push notifications.
 * Google sends a lightweight notification — not the full event payload.
 * The correct response is to re-fetch the changed calendar's events.
 *
 * Headers sent by Google:
 *   X-Goog-Channel-ID       — the channel ID we registered
 *   X-Goog-Channel-Token    — our secret token (validate this!)
 *   X-Goog-Resource-State   — "sync" | "exists" | "not_exists"
 *   X-Goog-Resource-ID      — the calendar resource ID
 *   X-Goog-Resource-URI     — the calendar events URI
 *
 * Security: Always validate X-Goog-Channel-Token against GOOGLE_WEBHOOK_SECRET.
 * Reject requests with invalid tokens — they may be spoofed.
 */
export async function POST(request: NextRequest) {
  const channelToken    = request.headers.get("X-Goog-Channel-Token");
  const channelId       = request.headers.get("X-Goog-Channel-ID");
  const resourceState   = request.headers.get("X-Goog-Resource-State");
  const resourceId      = request.headers.get("X-Goog-Resource-ID");

  // Validate the webhook secret token
  const expectedToken = process.env.GOOGLE_WEBHOOK_SECRET;
  if (expectedToken && channelToken !== expectedToken) {
    console.warn("[google/webhook] Invalid channel token — ignoring");
    return new NextResponse(null, { status: 200 }); // Always 200 to Google
  }

  // "sync" is the initial verification ping — acknowledge and return
  if (resourceState === "sync") {
    console.log(`[google/webhook] Sync ping for channel ${channelId}`);
    return new NextResponse(null, { status: 200 });
  }

  // "exists" — a calendar resource was created or modified
  if (resourceState === "exists") {
    console.log(`[google/webhook] Change detected on resource ${resourceId}`);

    // ── Production actions ─────────────────────────────────────────────
    // 1. Identify which user owns this channelId (look up in DB).
    // 2. Fetch fresh events for this calendar.
    // 3. Upsert/delete changed events in the DC Copilot DB.
    // 4. Emit a server-sent event (or publish to Redis pub/sub) so the
    //    frontend invalidates its TanStack Query cache in real time.
    //
    // await invalidateUserCalendarCache(channelId);
    // await triggerCallSyncForChannel(channelId);
  }

  // Always respond 200 to Google — any non-2xx causes exponential backoff
  return new NextResponse(null, { status: 200 });
}
