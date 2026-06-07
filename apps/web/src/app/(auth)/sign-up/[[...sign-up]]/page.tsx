import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFormPanel, AuthSetupNotice } from "@/components/auth/auth-page-shell";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { authClerkAppearance } from "@/lib/clerk-appearance";
import { isClerkConfigured } from "@/lib/public-env";

export const metadata: Metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (isLocalAuthBypassEnabled()) redirect("/home");

  if (!isClerkConfigured()) {
    return (
      <AuthFormPanel title="Create account" description="Get started with Discovery Call workflows.">
        <AuthSetupNotice title="Sign-up not configured">
          <p>Configure Clerk keys in your environment variables, then redeploy.</p>
        </AuthSetupNotice>
      </AuthFormPanel>
    );
  }

  return (
    <AuthFormPanel headerInCard title="Create your account" description="Join your team on the DC platform.">
      <SignUp appearance={authClerkAppearance} />
    </AuthFormPanel>
  );
}
