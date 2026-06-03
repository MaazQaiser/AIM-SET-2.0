"use client";

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { useLandingPageActivity } from "@/lib/data/clp-hooks";

interface PostDcClpAnalyticsWidgetProps {
  callId: string;
  enabled?: boolean;
}

export function PostDcClpAnalyticsWidget({ callId, enabled = true }: PostDcClpAnalyticsWidgetProps) {
  const { data } = useLandingPageActivity(callId);

  if (!enabled || !data?.metrics) return null;

  const m = data.metrics;

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Landing page engagement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="Link opens" value={m.linkOpens} />
          <Metric label="Visitors" value={m.uniqueVisitors} />
          <Metric label="Doc opens" value={m.documentOpens} />
          <Metric label="Proposal views" value={m.proposalOpens} />
        </dl>
        <Link
          href={`/calls/${callId}/landing-page/activity`}
          className="text-xs text-primary hover:underline mt-3 inline-block"
        >
          Full activity report
        </Link>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
