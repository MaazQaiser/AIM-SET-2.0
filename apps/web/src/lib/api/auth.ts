import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isLocalAuthBypassEnabled, LOCAL_AUTH_USER_ID } from "@/lib/auth-mode";
import { isClerkConfigured, isClerkSecretConfigured } from "@/lib/public-env";

export async function auth() {
  if (isLocalAuthBypassEnabled()) {
    return { userId: LOCAL_AUTH_USER_ID, orgId: null };
  }

  if (!isClerkConfigured() || !isClerkSecretConfigured()) {
    return { userId: null, orgId: null };
  }

  return clerkAuth();
}
