import { auth } from "@/lib/api/auth";
import { NextResponse, type NextRequest } from "next/server";

interface Params {
  params: Promise<{ callId: string }>;
}

function apiHeaders(userId: string, orgId: string | null | undefined) {
  return {
    "x-user-id": userId,
    ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
  };
}

/** Hydrate live cockpit from persisted transcript + suggestions (local testing / refresh). */
export async function GET(_request: NextRequest, { params }: Params) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await params;
  const base = process.env.API_URL ?? "http://localhost:8000";
  const headers = apiHeaders(userId, orgId);

  const [eventsRes, suggestionsRes] = await Promise.all([
    fetch(`${base}/api/v1/calls/${callId}/transcript-events`, {
      headers,
      cache: "no-store",
    }),
    fetch(`${base}/api/v1/calls/${callId}/suggestions`, {
      headers,
      cache: "no-store",
    }),
  ]);

  if (!eventsRes.ok && !suggestionsRes.ok) {
    return NextResponse.json(
      { error: "Failed to load live session" },
      { status: eventsRes.status || suggestionsRes.status }
    );
  }

  const events = eventsRes.ok ? await eventsRes.json() : [];
  const suggestions = suggestionsRes.ok ? await suggestionsRes.json() : [];

  return NextResponse.json({ events, suggestions });
}
