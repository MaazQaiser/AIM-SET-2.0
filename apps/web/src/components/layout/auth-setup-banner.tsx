import Link from "next/link";
import { clerkKeyHints, getDeploymentAuthStatus } from "@/lib/deployment-auth";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

/** Shown when Clerk or API_URL is missing on deployed environments. */
export function AuthSetupBanner() {
  if (isLocalAuthBypassEnabled()) return null;

  const status = getDeploymentAuthStatus();
  if (status.clerkReady && status.apiUrlConfigured) return null;

  const hints = clerkKeyHints();

  return (
    <div
      role="alert"
      className="mx-6 mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
    >
      <p className="font-medium text-amber-900 dark:text-amber-100">
        Deployment setup incomplete
      </p>
      <p className="mt-1 text-muted-foreground">
        Sign-in and API data require Clerk keys and a public FastAPI URL. Until these are
        set, you will see &quot;Auth not configured&quot; and requests return 401.
      </p>
      {status.missing.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-0.5">
          {status.missing.map((name) => (
            <li key={name}>
              <code className="text-xs bg-muted px-1 rounded">{name}</code>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-muted-foreground">
        Publishable: {hints.publishable} · Secret: {hints.secret}
        {status.apiUrlHost ? ` · API_URL host: ${status.apiUrlHost}` : null}
      </p>
      <p className="mt-2 text-xs">
        Vercel → Project → Settings → Environment Variables → enable for{" "}
        <strong>Production</strong> → <strong>Redeploy</strong> (required after adding{" "}
        <code className="bg-muted px-1 rounded">NEXT_PUBLIC_*</code> keys). Add your Vercel
        URL under{" "}
        <a
          href="https://dashboard.clerk.com/"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Clerk → Domains
        </a>
        . See{" "}
        <Link href="https://github.com/MaazQaiser/AIM-SET-2.0/blob/main/docs/VERCEL_DEPLOYMENT.md" className="underline">
          VERCEL_DEPLOYMENT.md
        </Link>
        .
      </p>
    </div>
  );
}
