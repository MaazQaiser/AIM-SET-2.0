import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { isClerkConfigured } from "@/lib/public-env";

export const metadata: Metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  if (isLocalAuthBypassEnabled()) redirect("/");

  if (!isClerkConfigured()) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">
          Configure Clerk keys in Vercel Environment Variables, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <span className="text-xl font-bold">DC</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground">DC Copilot</h1>
          <p className="text-sm text-muted-foreground">Create your account</p>
        </div>

        <SignUp
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "shadow-md rounded-xl border border-border bg-card",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "border border-border bg-background text-foreground hover:bg-accent",
              formButtonPrimary:
                "bg-primary text-primary-foreground hover:bg-primary/90",
              footerActionLink: "text-primary",
            },
          }}
        />
      </div>
    </div>
  );
}
