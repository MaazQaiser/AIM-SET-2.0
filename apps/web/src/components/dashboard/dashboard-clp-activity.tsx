"use client";

import Link from "next/link";
import { BarChart3, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Button } from "@dc-copilot/ui/components/button";
import { useClpOrgAnalytics, useLandingPage } from "@/lib/data/clp-hooks";
import { useCalls } from "@/lib/data/hooks";
import { PostDcClpStatusCard } from "@/components/post-dc/post-dc-clp-status-card";

/** Surfaces the most engaged published landing page on the home dashboard. */
export function DashboardClpActivity() {
  const { data: analytics } = useClpOrgAnalytics();
  const { data: calls = [] } = useCalls();

  const topCallId =
    analytics?.topAccounts?.[0]?.callId ??
    [...calls]
      .filter((c) => c.status === "completed")
      .sort(
        (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      )[0]?.id;

  const { data: page } = useLandingPage(topCallId ?? "");

  if (!analytics && !topCallId) return null;

  if (topCallId && (page?.status === "published" || page?.status === "draft")) {
    return (
      <section className="space-y-1.5">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Landing page activity
        </h2>
        <div className="max-w-md">
          <PostDcClpStatusCard callId={topCallId} page={page} />
        </div>
      </section>
    );
  }

  if (!analytics || analytics.publishedCount === 0) return null;

  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Landing page activity
      </h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Lead hubs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <dl className="grid grid-cols-2 gap-3">
            <Metric label="Published pages" value={analytics.publishedCount} />
            <Metric label="Unique visitors" value={analytics.totalUniqueVisitors} />
            <Metric label="Link opens" value={analytics.totalLinkOpens} />
            <Metric
              label="Proposal view rate"
              value={`${Math.round(analytics.proposalViewRate * 100)}%`}
            />
          </dl>
          <Button asChild variant="outline" size="sm">
            <Link href="/analytics/landing-pages">
              <BarChart3 className="h-3 w-3 mr-1" />
              View analytics
            </Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
