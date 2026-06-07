"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, TrendingUp } from "lucide-react";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useCoachingInsights } from "@/lib/data/hooks";

export default function CoachingAePage({ params }: { params: Promise<{ aeId: string }> }) {
  const { aeId } = use(params);
  const { data: insights = [] } = useCoachingInsights();
  const displayName = decodeURIComponent(aeId).replace(/-/g, " ");

  return (
    <PageShell size="narrow">
      <PageHeader className="space-y-3">
        <Link
          href="/coaching"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Coaching
        </Link>

        <div>
          <h1 className="text-2xl font-semibold capitalize">{displayName}</h1>
          <p className="text-sm text-muted-foreground mt-1">Individual scorecard · transcript evidence</p>
        </div>
      </PageHeader>

      {insights.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {insights.length} coaching recommendation(s) available on the team coaching page.
        </p>
      ) : (
        <EmptyState
          icon={TrendingUp}
          title="No scorecard data yet"
          description="Coaching evidence and transcript moments will appear after calls are analyzed."
        />
      )}
    </PageShell>
  );
}
