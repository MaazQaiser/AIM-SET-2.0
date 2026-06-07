"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useLandingPageActivity } from "@/lib/data/clp-hooks";
import { formatDistanceToNow } from "date-fns";

interface PageParams {
  params: Promise<{ callId: string }>;
}

export default function LandingPageActivityPage({ params }: PageParams) {
  const { callId } = use(params);
  const { data, isLoading } = useLandingPageActivity(callId);

  return (
    <PageShell size="wide">
      <PageHeader className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href={`/calls/${callId}/post-dc`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Landing page activity</h1>
      </PageHeader>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}

      {data?.metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="Link opens" value={data.metrics.linkOpens} />
          <Metric label="Visitors" value={data.metrics.uniqueVisitors} />
          <Metric label="Doc opens" value={data.metrics.documentOpens} />
          <Metric label="Proposal views" value={data.metrics.proposalOpens} />
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-2">Visitors</h2>
        <ul className="space-y-2 text-sm">
          {(data?.visitors ?? []).map((v) => (
            <li key={v.id} className="rounded-md border px-3 py-2">
              <span className="font-medium">{v.name}</span> · {v.email} · {v.visitCount} visits ·
              last {formatDistanceToNow(new Date(v.lastSeenAt), { addSuffix: true })}
              {v.proposalViewed && (
                <span className="ml-2 text-xs text-primary">· viewed proposal</span>
              )}
              {(v.documentsOpened?.length ?? 0) > 0 && (
                <span className="block text-xs text-muted-foreground mt-1">
                  Opened {v.documentsOpened!.length} document(s)
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2">Event timeline</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(data?.events ?? []).map((e) => (
            <li key={e.id}>
              {e.eventType} · {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
