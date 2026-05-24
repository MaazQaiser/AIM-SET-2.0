"use client";

import Link from "next/link";
import { FileText, Mail, TrendingUp, Bot } from "lucide-react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { useCalls } from "@/lib/data/hooks";
import type { Call } from "@/types";
import { cn } from "@/lib/cn";

function nextBriefHref(calls: Call[]): string {
  const next = [...calls]
    .filter((c) => (c.status === "upcoming" || c.status === "live") && c.briefReady)
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )[0];
  return next ? `/calls/${next.id}` : "/calls";
}

const ACTIONS = [
  {
    id: "brief",
    label: "Open next brief",
    description: "Pre-DC brief for your next call",
    icon: FileText,
    href: (calls: Call[]) => nextBriefHref(calls),
  },
  {
    id: "approvals",
    label: "Review pending approvals",
    description: "Emails & CRM tasks from Task Agent",
    icon: Mail,
    href: () => "/calls/call-001?tab=post-dc",
  },
  {
    id: "coaching",
    label: "Today's coaching",
    description: "Patterns and scorecards",
    icon: TrendingUp,
    href: () => "/coaching",
  },
  {
    id: "agents",
    label: "Agent activity",
    description: "Monitor all 5 specialist agents",
    icon: Bot,
    href: () => "/agents",
  },
] as const;

export function QuickActions() {
  const { data: calls = [] } = useCalls();

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const link =
            action.id === "brief" ? action.href(calls) : action.href();

          return (
            <Link key={action.id} href={link}>
              <Card className="h-full transition-shadow hover:shadow-md hover:border-primary/30">
                <CardContent className="p-4 flex flex-col gap-2">
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{action.label}</p>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {action.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
