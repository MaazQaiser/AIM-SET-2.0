"use client";

import { Sparkles, DollarSign, Target, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { useAiTodos } from "@/hooks/use-ai-todos";
import { useDailyBriefing } from "@/hooks/use-daily-briefing";
import { useCalls } from "@/lib/data/hooks";
import { isSameDay, startOfDay } from "date-fns";

function buildFallbackParagraph(
  todaysCallsCount: number,
  top: ReturnType<typeof useAiTodos>["topOpportunityCall"],
  pendingApprovalCount: number,
  briefsNotReady: number
): string {
  const account = top?.accountName ?? "your pipeline";
  const revenue = top?.annualRevenue;
  const lead = top?.leadName;

  if (todaysCallsCount === 0) {
    return (
      "No discovery calls on the calendar today. Use the time to clear pending approvals, " +
      "review coaching insights, or prep for upcoming meetings in the week view."
    );
  }
  if (top) {
    let paragraph = `Your highest-value touchpoint today is ${account}${revenue ? ` (${revenue})` : ""}. `;
    if (lead) {
      paragraph += `${lead} is on the invite — anchor discovery on their stated pains before pricing enters the room. `;
    }
    if (pendingApprovalCount > 0) {
      paragraph += `You have ${pendingApprovalCount} post-call item${pendingApprovalCount > 1 ? "s" : ""} waiting for approval — clearing those before your first call keeps the Task Agent from stalling outbound follow-ups.`;
    } else if (briefsNotReady > 0) {
      paragraph += `${briefsNotReady} brief${briefsNotReady > 1 ? "s are" : " is"} still generating; open each pre-DC view once the Content Agent finishes.`;
    } else {
      paragraph += "All briefs are ready — skim the AI summary on each call page before you join.";
    }
    return paragraph;
  }
  return `You have ${todaysCallsCount} call${todaysCallsCount > 1 ? "s" : ""} today. Prioritise prep on accounts with the strongest revenue signal and confirm pod coverage for technical depth.`;
}

export function DailyBriefingCard({ enabled = true }: { enabled?: boolean }) {
  const { data: calls = [] } = useCalls();
  const { topOpportunityCall, pendingApprovalCount, todos } = useAiTodos();
  const { data: briefing, isLoading } = useDailyBriefing(enabled);

  const today = startOfDay(new Date());
  const todaysCalls = calls.filter(
    (c) =>
      (c.status === "upcoming" || c.status === "live") &&
      isSameDay(new Date(c.scheduledAt), today)
  );
  const briefsNotReady = todaysCalls.filter((c) => !c.briefReady).length;
  const highPriorityTodos = todos.filter((t) => t.priority === "high").length;

  const top = topOpportunityCall;
  const revenue = top?.annualRevenue;
  const stage = top?.dealStage ?? "Discovery";

  const paragraph =
    briefing?.paragraph ??
    buildFallbackParagraph(
      todaysCalls.length,
      top,
      pendingApprovalCount,
      briefsNotReady
    );
  const statChips = (
    <>
      {revenue && (
        <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-3 py-1 type-caption font-semibold text-foreground">
          <DollarSign className="h-3 w-3 text-warning" />
          Top opp: {revenue}
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 type-caption font-medium text-foreground">
        <Target className="h-3 w-3" />
        {stage}
      </span>
      {todaysCalls.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 type-caption text-muted-foreground">
          {todaysCalls.length} call{todaysCalls.length !== 1 ? "s" : ""} today
        </span>
      )}
      {highPriorityTodos > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-3 py-1 type-caption font-semibold text-destructive">
          <AlertCircle className="h-3 w-3" />
          {highPriorityTodos} high-priority action{highPriorityTodos !== 1 ? "s" : ""}
        </span>
      )}
    </>
  );

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 shrink-0 text-warning" />
            <span className="type-title text-foreground">Daily briefing</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
            {statChips}
          </div>
        </div>
        {isLoading && !briefing ? (
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ) : (
          <p className="type-body-sm leading-relaxed text-foreground/90">{paragraph}</p>
        )}
      </CardContent>
    </Card>
  );
}
