"use client";

import Link from "next/link";
import { FileText, Mail, TrendingUp, Bot } from "lucide-react";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { latestPostDcHref } from "@/lib/dashboard/call-links";
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
    description: "Post-DC emails and tasks after wrap-up",
    icon: Mail,
    href: (calls: Call[]) => latestPostDcHref(calls),
  },
  {
    id: "coaching",
    label: "Today's coaching",
    description: "Patterns and scorecards",
    icon: TrendingUp,
    href: (_calls: Call[]) => "/coaching",
  },
  {
    id: "agents",
    label: "Agent activity",
    description: "Monitor all 5 specialist agents",
    icon: Bot,
    href: (_calls: Call[]) => "/agents",
  },
] as const;

export function QuickActions() {
  const { data: calls = [] } = useCalls();

  return (
    <section className="space-y-1">
      <h2 className="type-label text-muted-foreground">
        Quick actions
      </h2>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const link = action.href(calls);

          return (
            <Link key={action.id} href={link} className="group block h-full">
              <Card
                className={cn(
                  "h-full",
                  "transition-[border-color,box-shadow] duration-200",
                  "hover:border-white/90 hover:shadow-[0_2px_10px_rgb(17_17_17/0.06)]"
                )}
              >
                <CardContent className="flex min-h-[58px] items-center gap-2.5 p-2.5">
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                      "border border-white/60 bg-white/45 text-primary",
                      "shadow-[inset_0_1px_0_rgb(255_255_255/0.85)]",
                      "backdrop-blur-sm"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate type-label text-foreground">{action.label}</p>
                    <p className="truncate type-caption text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
