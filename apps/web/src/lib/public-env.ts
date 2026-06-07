/**
 * Public (NEXT_PUBLIC_*) and build-time env helpers for Vercel + local dev.
 * Secrets (CLERK_SECRET_KEY, INTERNAL_API_SECRET) must be set in Vercel → Environment Variables.
 */

const PLACEHOLDER_RE = /\.{3}|your[-_]|change_me|example\.com/i;

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

function isRealValue(value: string): boolean {
  if (!value) return false;
  if (PLACEHOLDER_RE.test(value)) return false;
  return true;
}

/** Clerk publishable key — required for auth in production runtime. */
export function getClerkPublishableKey(): string {
  return clean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

export function isClerkConfigured(): boolean {
  const key = getClerkPublishableKey();
  return isRealValue(key) && key.startsWith("pk_");
}

export function getClerkSecretKey(): string {
  return clean(process.env.CLERK_SECRET_KEY);
}

export function isClerkSecretConfigured(): boolean {
  const key = getClerkSecretKey();
  return isRealValue(key) && key.startsWith("sk_");
}

/** BFF → FastAPI (server-only). */
export function getApiUrl(): string {
  return (
    clean(process.env.API_URL) ||
    clean(process.env.INTERNAL_API_URL) ||
    "http://localhost:8000"
  );
}

export function getPublicApiUrl(): string {
  return clean(process.env.NEXT_PUBLIC_API_URL) || getApiUrl();
}

export function getPublicWsUrl(): string {
  const raw = clean(process.env.NEXT_PUBLIC_WS_URL);
  if (raw) return raw;
  const api = getPublicApiUrl();
  if (api.startsWith("https://")) return api.replace(/^https:/, "wss:");
  if (api.startsWith("http://")) return api.replace(/^http:/, "ws:");
  return "ws://localhost:8000";
}

export function getInternalApiSecret(): string {
  return clean(process.env.INTERNAL_API_SECRET);
}

export const clerkUrls = {
  signIn: clean(process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL) || "/sign-in",
  signUp: clean(process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL) || "/sign-up",
  afterSignIn: clean(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL) || "/dashboard",
  afterSignUp: clean(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL) || "/dashboard",
} as const;

export function getPublicAppUrl(): string {
  return (
    clean(process.env.NEXT_PUBLIC_APP_URL) ||
    clean(process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
    "http://localhost:3000"
  );
}

/** Call during `next build` on Vercel to surface missing Clerk before deploy. */
export function assertVercelBuildEnv(): void {
  if (process.env.VERCEL !== "1") return;
  if (!isClerkConfigured()) {
    throw new Error(
      "Vercel build: set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY (pk_test_ or pk_live_ from Clerk Dashboard → API Keys)."
    );
  }
  if (!isClerkSecretConfigured()) {
    throw new Error(
      "Vercel build: set CLERK_SECRET_KEY (sk_test_ or sk_live_ from Clerk Dashboard → API Keys)."
    );
  }
}
