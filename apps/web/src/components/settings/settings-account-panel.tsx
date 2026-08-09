"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@dc-copilot/ui/components/card";
import { useClerkGate } from "@/components/providers/clerk-gate";
import { PersonaSwitcher } from "@/components/layout/persona-switcher";
import { usePersona } from "@/hooks/use-persona";
import { PERSONA_LABELS } from "@/lib/persona";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { clerkUrls } from "@/lib/public-env";

export function SettingsAccountPanel() {
  const clerkEnabled = useClerkGate();
  const authBypass = isLocalAuthBypassEnabled();
  const { user, isLoaded } = useUser();
  const persona = usePersona();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Home experience</CardTitle>
          <CardDescription>
            Switch the dashboard view. Sales Leadership shows coaching candidates and live calls;
            Account Executive shows today&apos;s todos and upcoming agenda.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-sm text-muted-foreground">
            Current: <span className="font-medium text-foreground">{PERSONA_LABELS[persona]}</span>
          </p>
          <PersonaSwitcher />
        </CardContent>
      </Card>

      {authBypass ? (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Local auth bypass is active — sign-in is skipped in development.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link href={clerkUrls.signIn}>Open sign-in page</Link>
            </Button>
          </CardContent>
        </Card>
      ) : !clerkEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Clerk is not configured for this environment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="type-body-sm text-muted-foreground">
              Sign-in URL:{" "}
              <Link href={clerkUrls.signIn} className="text-primary hover:underline">
                {clerkUrls.signIn}
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              {isLoaded && user
                ? `Signed in as ${user.primaryEmailAddress?.emailAddress ?? user.fullName ?? "your account"}`
                : "Manage your session"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <SignOutButton redirectUrl="/">
              <Button variant="outline" className="gap-2">
                <LogOut className="h-4 w-4" aria-hidden />
                Log out
              </Button>
            </SignOutButton>
            <p className="type-body-sm text-muted-foreground">
              You will return to the FullSphere landing page after signing out.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
