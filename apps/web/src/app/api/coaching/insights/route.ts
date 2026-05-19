import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/** Coaching insights API — returns empty until backend endpoint exists. */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json([]);
}
