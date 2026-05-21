import { auth as clerkAuth } from "@clerk/nextjs/server";
import { isLocalAuthBypassEnabled, LOCAL_AUTH_USER_ID } from "@/lib/auth-mode";

export async function auth() {
  if (isLocalAuthBypassEnabled()) {
    return { userId: LOCAL_AUTH_USER_ID, orgId: null };
  }

  return clerkAuth();
}
