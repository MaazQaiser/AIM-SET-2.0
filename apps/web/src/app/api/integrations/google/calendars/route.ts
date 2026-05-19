import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * GET /api/integrations/google/calendars
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ calendars: [] });
}

/**
 * PATCH /api/integrations/google/calendars
 * Body: { selectedIds: string[] }
 */
export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { selectedIds?: string[] };
  if (!Array.isArray(body.selectedIds)) {
    return NextResponse.json({ error: "selectedIds must be an array" }, { status: 400 });
  }

  return NextResponse.json({ ok: true, selectedIds: body.selectedIds });
}
