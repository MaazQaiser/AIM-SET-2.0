export const LOCAL_AUTH_USER_ID =
  process.env.NEXT_PUBLIC_AUTH_BYPASS_USER_ID || "local-dev-user";

export function isLocalAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_AUTH_BYPASS === "true"
  );
}
