"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CallDetailColumnLayout } from "@/components/calls/call-detail-column-layout";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { BRIEF_WIDGETS } from "@/lib/dashboard/widget-registry";
import { normalizeBriefWidgetProps } from "@/lib/dashboard/normalize-widget-props";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { resolvePostCallReview } from "@/lib/dc-data/resolvers";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import { usePersona } from "@/hooks/use-persona";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { Button } from "@dc-copilot/ui/components/button";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { CallDetailPageLoader } from "@/components/layout/page-loaders";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import type { SdrHandoffSummaryItem } from "@/lib/dc-notes/build-from-import";
import type { BANTScore, Call } from "@/types";
import { cn } from "@/lib/cn";

interface CallDetailTabsProps {
  callId: string;
  discoveryQuestions: string[];
  sdrHandoffSummary: SdrHandoffSummaryItem[];
  bant: BANTScore;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

/** Pre-call brief body (no tab chrome — Post-DC lives on `/calls/[id]/post-dc`). */
export function CallDetailTabs({
  callId,
  discoveryQuestions,
  sdrHandoffSummary,
  bant,
  call,
  accountSnapshot,
}: CallDetailTabsProps) {
  const { isIntercom } = useThemePreview();
  const queryClient = useQueryClient();
  const { data: brief, isLoading: briefLoading, refetch: refetchBrief } = useCallBrief(callId);
  const { data: review } = usePostCallReview(callId);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const persona = usePersona();
  const setCallStatus = useDcImportsStore((s) => s.setCallStatus);

  const leadershipPreview = persona === "leadership";
  const importedReview = resolvePostCallReview(callId);
  const postDcReady = Boolean(review ?? importedReview);

  useEffect(() => {
    if (!postDcReady || call.status === "completed") return;
    setCallStatus(callId, "completed");
    void fetch(`/api/calls/${callId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed" }),
    }).finally(() => {
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
      void queryClient.invalidateQueries({ queryKey: ["call", callId] });
    });
  }, [call.status, callId, postDcReady, queryClient, setCallStatus]);

  const runPreDcWorkflow = async () => {
    setRunningWorkflow(true);
    try {
      const res = await fetch(`/api/calls/${callId}/generate-brief`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        throw new Error(err?.detail ?? err?.error ?? `Workflow failed (${res.status})`);
      }
      await refetchBrief();
      void queryClient.invalidateQueries({ queryKey: ["call-brief", callId] });
      toast.success("PRE-DC Workflow completed for this lead.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not run PRE-DC Workflow");
    } finally {
      setRunningWorkflow(false);
    }
  };

  if (briefLoading && !brief) {
    return <CallDetailPageLoader />;
  }

  if (!brief) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Pre-DC brief is still loading"
        description="Your lead was saved. PRE-DC Workflow builds the AI summary and artifacts from that data — usually under a minute. You do not need to import a CSV."
        action={{
          label: runningWorkflow ? "Running…" : "Run PRE-DC Workflow now",
          onClick: () => void runPreDcWorkflow(),
        }}
      />
    );
  }

  return (
    <div className="mt-3 pb-28 focus-visible:outline-none">
      {postDcReady && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="type-caption text-muted-foreground">
            This call has been wrapped. Post-DC review is ready.
          </p>
          <Button asChild variant="outline" size="sm" className="h-8 shrink-0 type-label">
            <Link href={`/calls/${callId}/post-dc`}>
              <ExternalLink className="mr-1 h-3 w-3" />
              Open Post-DC
            </Link>
          </Button>
        </div>
      )}

      {leadershipPreview && (
        <div
          className={cn(
            "mb-2 px-4 py-2 type-label",
            isIntercom
              ? "rounded-md border border-border bg-muted/30 text-muted-foreground"
              : "rounded-md border border-dashed border-primary/40 bg-primary/5 text-muted-foreground"
          )}
        >
          Leadership read-only preview — brief updates as the AE prepares.
        </div>
      )}
      <LayoutControls
        layoutKey="brief"
        widgets={BRIEF_WIDGETS}
        widgetProps={normalizeBriefWidgetProps({
          brief,
          bant,
          discoveryQuestions,
          sdrHandoffSummary,
          leadershipPreview,
          call,
          accountSnapshot,
        })}
      />
      <CallDetailColumnLayout
        layoutKey="brief"
        widgets={BRIEF_WIDGETS}
        widgetProps={normalizeBriefWidgetProps({
          brief,
          bant,
          discoveryQuestions,
          sdrHandoffSummary,
          leadershipPreview,
          call,
          accountSnapshot,
        })}
      />
      <BotChatPanel
        callId={callId}
        variant="floating"
        phase="prep"
        surface="pre_dc"
        accountName={call.accountName}
        brief={brief}
        checklist={seedChecklistFromCall(call)}
      />
    </div>
  );
}
