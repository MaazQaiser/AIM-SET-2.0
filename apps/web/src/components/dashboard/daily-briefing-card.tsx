"use client";

import { Sparkles, DollarSign, Target, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { useAiTodos } from "@/hooks/use-ai-todos";
import { useCalls } from "@/lib/data/hooks";
import { isSameDay, startOfDay } from "date-fns";

export function DailyBriefingCard() {
  const { data: calls = [] } = useCalls();
  const { topOpportunityCall, pendingApprovalCount, todos } = useAiTodos();

  const today = startOfDay(new Date());
  const todaysCalls = calls.filter(
    (c) =>
      (c.status === "upcoming" || c.status === "live") &&
      isSameDay(new Date(c.scheduledAt), today)
  );
  const briefsNotReady = todaysCalls.filter((c) => !c.briefReady).length;
  const highPriorityTodos = todos.filter((t) => t.priority === "high").length;

  const top = topOpportunityCall;
  const account = top?.accountName ?? "your pipeline";
  const revenue = top?.annualRevenue;
  const stage = top?.dealStage ?? "Discovery";
  const lead = top?.leadName;

  let paragraph: string;
  if (todaysCalls.length === 0) {
    paragraph =
      "No discovery calls on the calendar today. Use the time to clear pending approvals, review coaching insights, or prep for upcoming meetings in the week view.";
  } else if (top) {
    paragraph = `Your highest-value touchpoint today is ${account}${revenue ? ` (${revenue})` : ""}. `;
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
  } else {
    paragraph = `You have ${todaysCalls.length} call${todaysCalls.length > 1 ? "s" : ""} today. Prioritise prep on accounts with the strongest revenue signal and confirm pod coverage for technical depth.`;
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5 pt-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-warning" />
        <span className="type-title text-foreground">Daily briefing</span>
        <AIGeneratedBadge />
      </div>
      <p className="type-body-sm leading-relaxed text-foreground/90">{paragraph}</p>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/50">
        {revenue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted border border-border/50 px-2.5 py-0.5 type-caption font-semibold">
            <DollarSign className="h-3 w-3 text-success" />
            Top opp: {revenue}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted px-2.5 py-0.5 type-caption font-medium text-foreground">
          <Target className="h-3 w-3" />
          {stage}
        </span>
        {todaysCalls.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted px-2.5 py-0.5 type-caption text-muted-foreground">
            {todaysCalls.length} call{todaysCalls.length !== 1 ? "s" : ""} today
          </span>
        )}
        {highPriorityTodos > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-0.5 type-caption font-medium text-warning">
            <AlertCircle className="h-3 w-3" />
            {highPriorityTodos} high-priority action{highPriorityTodos !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      </CardContent>
    </Card>
  );
}
