"use client";

import { useClpOrgAnalytics } from "@/lib/data/clp-hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";

export function LandingPageDashboard() {
  const { data, isLoading } = useClpOrgAnalytics();

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const funnel = data?.funnel;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Landing page analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Engagement across published customer landing pages
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published pages" value={data?.publishedCount ?? 0} />
        <StatCard label="Link opens" value={data?.totalLinkOpens ?? 0} />
        <StatCard label="Unique visitors" value={data?.totalUniqueVisitors ?? 0} />
        <StatCard
          label="Proposal view rate"
          value={`${Math.round((data?.proposalViewRate ?? 0) * 100)}%`}
        />
      </div>

      {funnel && (
        <Card className="app-card">
          <CardHeader>
            <CardTitle className="text-base">Engagement funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid sm:grid-cols-5 gap-3 text-sm">
              <FunnelStep label="Published" value={funnel.published} />
              <FunnelStep label="Link opened" value={funnel.linkOpened} />
              <FunnelStep label="Identified" value={funnel.identitySubmitted} />
              <FunnelStep label="Doc opened" value={funnel.documentOpened} />
              <FunnelStep label="Proposal opened" value={funnel.proposalOpened} />
            </ul>
          </CardContent>
        </Card>
      )}

      {(data?.topAccounts?.length ?? 0) > 0 && (
        <Card className="app-card">
          <CardHeader>
            <CardTitle className="text-base">Top engaged accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm space-y-2">
              {data!.topAccounts.map((row) => (
                <li key={row.callId} className="flex justify-between gap-2">
                  <span>{row.accountName}</span>
                  <span className="text-muted-foreground tabular-nums">{row.engagementScore}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="app-card">
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelStep({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-md border px-3 py-2 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </li>
  );
}
