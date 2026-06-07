import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFormPanel, AuthSetupNotice } from "@/components/auth/auth-page-shell";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { isClerkConfigured } from "@/lib/public-env";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default function SignInPage() {
  if (isLocalAuthBypassEnabled()) redirect("/home");

  if (!isClerkConfigured()) {
    return (
      <AuthFormPanel title="Sign in" description="Access your Discovery Call workspace.">
        <AuthSetupNotice title="Sign-in not configured">
          <p>
            Add <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and{" "}
            <code>CLERK_SECRET_KEY</code> in your environment variables, then redeploy.
          </p>
        </AuthSetupNotice>
      </AuthFormPanel>
    );
  }

  return (
    <AuthFormPanel title="Welcome back" description="Sign in to continue to your workspace.">
      <SignIn appearance={clerkAppearance} />
    </AuthFormPanel>
  );
}
