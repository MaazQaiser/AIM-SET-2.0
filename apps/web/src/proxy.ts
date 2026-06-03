import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { isClerkConfigured, isClerkSecretConfigured } from "@/lib/public-env";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/health/deployment",
  "/p/(.*)",
  "/api/public/clp/(.*)",
]);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (
    isLocalAuthBypassEnabled() ||
    !isClerkConfigured() ||
    !isClerkSecretConfigured()
  ) {
    return NextResponse.next();
  }
  return clerkHandler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
