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
        <h1 className="type-page-title">Landing page activity</h1>
      </PageHeader>

      {isLoading && <p className="type-body-sm text-muted-foreground">Loading…</p>}

      {data?.metrics && (
        <div className="grid grid-cols-2 gap-3 type-body-sm sm:grid-cols-4">
          <Metric label="Link opens" value={data.metrics.linkOpens} />
          <Metric label="Visitors" value={data.metrics.uniqueVisitors} />
          <Metric label="Doc opens" value={data.metrics.documentOpens} />
          <Metric label="Proposal views" value={data.metrics.proposalOpens} />
        </div>
      )}

      <section>
        <h2 className="mb-2 type-section-title">Visitors</h2>
        <ul className="space-y-2 type-body-sm">
          {(data?.visitors ?? []).map((v) => (
            <li key={v.id} className="rounded-md border px-3 py-2">
              <span className="font-medium">{v.name}</span> · {v.email} · {v.visitCount} visits ·
              last {formatDistanceToNow(new Date(v.lastSeenAt), { addSuffix: true })}
              {v.proposalViewed && (
                <span className="ml-2 type-caption text-primary">· viewed proposal</span>
              )}
              {(v.documentsOpened?.length ?? 0) > 0 && (
                <span className="mt-1 block type-caption text-muted-foreground">
                  Opened {v.documentsOpened!.length} document(s)
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 type-section-title">Event timeline</h2>
        <ul className="space-y-1 type-caption text-muted-foreground">
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
      <p className="type-label text-muted-foreground">{label}</p>
      <p className="type-screen-title tabular-nums">{value}</p>
    </div>
  );
}
