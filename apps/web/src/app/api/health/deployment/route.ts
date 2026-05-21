import { NextResponse } from "next/server";
import { clerkKeyHints, getDeploymentAuthStatus } from "@/lib/deployment-auth";

/** Public deployment checklist (no secrets). */
export async function GET() {
  const status = getDeploymentAuthStatus();
  const hints = clerkKeyHints();
  return NextResponse.json({
    ...status,
    hints,
    vercel: process.env.VERCEL === "1",
  });
}
