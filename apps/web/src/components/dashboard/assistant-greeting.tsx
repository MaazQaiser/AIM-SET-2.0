"use client";

import { useUser } from "@clerk/nextjs";
import { format, isSameDay, startOfDay } from "date-fns";
import { useCalls, usePostCallCrmTasks } from "@/lib/data/hooks";

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

export function AssistantGreeting() {
  const { user, isLoaded } = useUser();
  const { data: calls = [] } = useCalls();
  const { data: crmTasks = [] } = usePostCallCrmTasks();

  const hour = new Date().getHours();
  const salutation = getSalutation(hour);
  const name = displayName(user?.firstName, user?.username);

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
      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
        {isLoaded ? (
          <>
            {salutation},{" "}
            <span className="text-primary">{name}</span>
          </>
        ) : (
          <span className="inline-block h-12 w-64 animate-pulse rounded-md bg-muted" />
        )}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{subLine}</p>
    </header>
  );
}
