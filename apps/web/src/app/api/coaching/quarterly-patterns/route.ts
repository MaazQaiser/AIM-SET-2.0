import { auth } from "@/lib/api/auth";
import { NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });
  return NextResponse.json([]);
}
