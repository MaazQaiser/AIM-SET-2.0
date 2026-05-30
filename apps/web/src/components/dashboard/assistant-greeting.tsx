"use client";

import { useUser } from "@clerk/nextjs";
import { format, isSameDay, startOfDay } from "date-fns";
import { useClerkGate } from "@/components/providers/clerk-gate";
import { useCalls, usePostCallCrmTasks } from "@/lib/data/hooks";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

function getSalutation(hour: number): string {
  if (hour >= 23 || hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function displayName(
  firstName?: string | null,
  username?: string | null
): string {
  if (firstName?.trim()) return firstName.trim();
  if (username?.trim()) return username.trim();
  return "there";
}

function AssistantGreetingWithClerk() {
  const clerkUser = useUser();
  return (
    <AssistantGreetingBody
      isLoaded={Boolean(clerkUser.isLoaded)}
      name={displayName(clerkUser.user?.firstName, clerkUser.user?.username)}
    />
  );
}

function AssistantGreetingBody({
  isLoaded,
  name,
}: {
  isLoaded: boolean;
  name: string;
}) {
  const { data: calls = [] } = useCalls();
  const { data: crmTasks = [] } = usePostCallCrmTasks();

  const hour = new Date().getHours();
  const salutation = getSalutation(hour);

  const today = startOfDay(new Date());
  const todaysCalls = calls.filter(
    (c) =>
      (c.status === "upcoming" || c.status === "live") &&
      isSameDay(new Date(c.scheduledAt), today)
  );
  const pendingApprovals = crmTasks.filter((t) => t.status === "pending_approval").length;

  const dateLine = format(new Date(), "EEEE, MMMM d");
  const statParts: string[] = [];
  if (todaysCalls.length > 0) {
    statParts.push(
      `${todaysCalls.length} call${todaysCalls.length !== 1 ? "s" : ""} today`
    );
  }
  if (pendingApprovals > 0) {
    statParts.push(
      `${pendingApprovals} pending approval${pendingApprovals !== 1 ? "s" : ""}`
    );
  }
  const subLine =
    statParts.length > 0 ? `${dateLine} · ${statParts.join(", ")}` : dateLine;

  return (
    <header className="pt-2">
      <h1 className="type-headline sm:type-display text-foreground">
        {isLoaded ? (
          <>
            {salutation},{" "}
            <span className="text-foreground">{name}</span>
          </>
        ) : (
          <span className="inline-block h-10 w-64 animate-pulse rounded-xl bg-muted" />
        )}
      </h1>
      <p className="mt-2 type-body-sm text-muted-foreground">{subLine}</p>
    </header>
  );
}

export function AssistantGreeting() {
  const clerkEnabled = useClerkGate();

  if (isLocalAuthBypassEnabled() || !clerkEnabled) {
    return <AssistantGreetingBody isLoaded name="there" />;
  }
  return <AssistantGreetingWithClerk />;
}
