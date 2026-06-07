"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Lightbulb } from "lucide-react";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useContentGaps } from "@/lib/data/hooks";

export default function ContentGapDetailPage({ params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = use(params);
  const router = useRouter();
  const { data: gaps = [] } = useContentGaps();
  const gap = gaps.find((g) => g.id === gapId);

  useEffect(() => {
    if (gap?.studioProjectId) {
      router.replace(`/content/studio/${gap.studioProjectId}`);
    }
  }, [gap?.studioProjectId, router]);

  if (!gap) {
    return (
      <PageShell size="narrow">
        <PageHeader>
          <Link href="/content" className="flex items-center gap-1 type-body text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
            Content
          </Link>
        </PageHeader>
        <EmptyState icon={Lightbulb} title="Content gap not found" description="No gap data is available yet." />
      </PageShell>
    );
  }

  if (gap.studioProjectId) {
    return (
      <PageShell size="narrow" className="type-body text-muted-foreground">
        Opening linked Studio project…
      </PageShell>
    );
  }

  return (
    <PageShell size="narrow">
      <PageHeader>
        <Link href="/content?tab=suggestions" className="flex items-center gap-1 type-body text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
          Content suggestions
        </Link>
      </PageHeader>
      <EmptyState
        icon={Lightbulb}
        title={gap.topic}
        description="Generate this asset from the Content suggestions tab to open it in Studio with a full evidence-backed plan."
      />
    </PageShell>
  );
}
