"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileSpreadsheet, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CallDetailColumnLayout } from "@/components/calls/call-detail-column-layout";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { BRIEF_WIDGETS, POST_DC_WIDGETS } from "@/lib/dashboard/widget-registry";
import {
  normalizeBriefWidgetProps,
  normalizePostDcWidgetProps,
} from "@/lib/dashboard/normalize-widget-props";
import { BotChatPanel } from "@/components/bot-chat-panel";
import { useCallBrief, usePostCallReview } from "@/lib/data/hooks";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import { usePersona } from "@/hooks/use-persona";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import type { BANTScore, Call } from "@/types";

interface CallDetailTabsProps {
  callId: string;
  initialTab?: "brief" | "post-dc";
  discoveryQuestions: string[];
  bant: BANTScore;
  call: Call;
  accountSnapshot: AccountSnapshotRow[];
}

export function CallDetailTabs({
  callId,
  initialTab = "brief",
  discoveryQuestions,
  bant,
  call,
  accountSnapshot,
}: CallDetailTabsProps) {
  const queryClient = useQueryClient();
  const { data: brief, isLoading: briefLoading, refetch: refetchBrief } = useCallBrief(callId);
  const { data: review, isLoading: reviewLoading } = usePostCallReview(callId);
  const [runningWorkflow, setRunningWorkflow] = useState(false);
  const persona = usePersona();
  const setEditing = useDashboardLayoutStore((s) => s.setEditing);
  const [activeTab, setActiveTab] = useState(initialTab);

  const leadershipPreview = persona === "leadership";
  const showJoinCall = call.status === "upcoming" || call.status === "live";

  const handleTabChange = (value: string) => {
    setActiveTab(value === "post-dc" ? "post-dc" : "brief");
    setEditing(false);
  };

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

  const centerActions = showJoinCall ? (
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">
          {call.status === "live" ? "Call in progress" : "Ready for discovery"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Open the live workspace for checklist, signals, and coaching.
        </p>
      </div>
      <Button asChild className="shrink-0">
        <Link href={`/calls/${call.id}/live`}>
          {call.status === "live" ? "Join live" : "Join call"}
        </Link>
      </Button>
    </div>
  ) : undefined;

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="flex-wrap h-auto gap-1">
        <TabsTrigger value="brief">Pre-call brief</TabsTrigger>
        <TabsTrigger value="post-dc" className="gap-1.5">
          Post-DC review
          {review && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[9px] font-medium text-primary">
              Ready
            </span>
          )}
        </TabsTrigger>
      </TabsList>
      {review && activeTab === "brief" && (
        <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Post-DC review is available — see headline, summary, and pod scorecard after wrap-up.
          </p>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
            <Link href={`/calls/${callId}/post-dc`}>
              <ExternalLink className="h-3 w-3 mr-1" />
              Open full screen
            </Link>
          </Button>
        </div>
      )}

      <TabsContent value="brief" className="mt-4">
        {briefLoading ? (
          <BriefTabSkeleton />
        ) : !brief ? (
          <EmptyState
            icon={Sparkles}
            title="Pre-DC brief is still loading"
            description="Your lead was saved. PRE-DC Workflow builds the AI summary and artifacts from that data — usually under a minute. You do not need to import a CSV."
            action={{
              label: runningWorkflow ? "Running…" : "Run PRE-DC Workflow now",
              onClick: () => void runPreDcWorkflow(),
            }}
          />
        ) : (
          <div className="pb-28">
            {leadershipPreview && (
              <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-4 py-2 text-xs text-muted-foreground mb-4">
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
                leadershipPreview,
                call,
                accountSnapshot,
              })}
              centerHeader={centerActions}
            />
            <BotChatPanel
              callId={callId}
              variant="floating"
              phase="prep"
              accountName={call.accountName}
              brief={brief}
              checklist={seedChecklistFromCall(call)}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="post-dc" className="mt-4">
        {reviewLoading ? (
          <PostDcTabSkeleton />
        ) : !review ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="No Post-DC notes for this call"
            description="Import post_dc_notes_data.csv in Settings. Rows link when company or lead names match Pre-DC data."
            action={{ label: "Import CSV", href: "/settings" }}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Full wrap-up view with layout controls — or open dedicated Post-DC screen.
              </p>
              <Button asChild variant="secondary" size="sm" className="h-8 text-xs">
                <Link href={`/calls/${callId}/post-dc`}>Full Post-DC screen</Link>
              </Button>
            </div>
            <LayoutControls
              layoutKey="post-dc"
              widgets={POST_DC_WIDGETS}
              widgetProps={normalizePostDcWidgetProps({ review, call, accountSnapshot })}
            />
            <CallDetailColumnLayout
              layoutKey="post-dc"
              widgets={POST_DC_WIDGETS}
              widgetProps={normalizePostDcWidgetProps({ review, call, accountSnapshot })}
            />
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

function BriefTabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-[minmax(220px,0.22fr)_1fr_minmax(240px,0.28fr)]">
        <Skeleton className="h-48 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

function PostDcTabSkeleton() {
  return <BriefTabSkeleton />;
}
