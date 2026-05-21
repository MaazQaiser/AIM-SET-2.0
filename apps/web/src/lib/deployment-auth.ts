import {
  getApiUrl,
  getClerkPublishableKey,
  getClerkSecretKey,
  isClerkConfigured,
  isClerkSecretConfigured,
} from "@/lib/public-env";

export type DeploymentAuthStatus = {
  clerkPublishable: boolean;
  clerkSecret: boolean;
  clerkReady: boolean;
  apiUrlConfigured: boolean;
  apiUrlHost: string;
  missing: string[];
};

/** Server-only: what blocks auth + BFF data on Vercel. */
export function getDeploymentAuthStatus(): DeploymentAuthStatus {
  const clerkPublishable = isClerkConfigured();
  const clerkSecret = isClerkSecretConfigured();
  const apiUrl = getApiUrl();
  const apiUrlConfigured =
    Boolean(apiUrl) &&
    !apiUrl.includes("localhost") &&
    !apiUrl.includes("127.0.0.1");

  let apiUrlHost = "";
  try {
    apiUrlHost = new URL(apiUrl).host;
  } catch {
    apiUrlHost = apiUrl || "(not set)";
  }

  const missing: string[] = [];
  if (!clerkPublishable) missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!clerkSecret) missing.push("CLERK_SECRET_KEY");
  if (!apiUrlConfigured) missing.push("API_URL (public FastAPI host, not your Vercel URL)");

  return {
    clerkPublishable,
    clerkSecret,
    clerkReady: clerkPublishable && clerkSecret,
    apiUrlConfigured,
    apiUrlHost,
    missing,
  };
}

/** Safe hints for operators (no secret values). */
export function clerkKeyHints(): { publishable: string; secret: string } {
  const pk = getClerkPublishableKey();
  const sk = getClerkSecretKey();
  return {
    publishable: pk
      ? `${pk.slice(0, 12)}… (${pk.length} chars, starts with ${pk.slice(0, 4)})`
      : "(empty)",
    secret: sk
      ? `${sk.slice(0, 10)}… (${sk.length} chars)`
      : "(empty)",
  };
}
