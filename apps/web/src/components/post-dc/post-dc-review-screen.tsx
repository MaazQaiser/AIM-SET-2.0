"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Pencil, Radio } from "lucide-react";
import { CallDetailColumnLayout } from "@/components/calls/call-detail-column-layout";
import { LayoutControls } from "@/components/dashboard-grid/layout-controls";
import { POST_DC_WIDGETS } from "@/lib/dashboard/widget-registry";
import { normalizePostDcWidgetProps } from "@/lib/dashboard/normalize-widget-props";
import { useCall, usePostCallReview } from "@/lib/data/hooks";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CallWrapUpActions } from "@/components/calls/call-wrap-up-actions";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";

interface PostDcReviewScreenProps {
  callId: string;
  /** Shown after user ends call from live workspace */
  justWrapped?: boolean;
  /** Inside live mobile tab — reduced chrome */
  embedded?: boolean;
  accountSnapshot?: AccountSnapshotRow[];
}

export function PostDcReviewScreen({
  callId,
  justWrapped = false,
  embedded = false,
  accountSnapshot = [],
}: PostDcReviewScreenProps) {
  const { data: call, isLoading: callLoading } = useCall(callId);
  const { data: review, isLoading: reviewLoading } = usePostCallReview(callId);
  const isEditingLayout = useDashboardLayoutStore((s) => s.isEditing);
  const setEditingLayout = useDashboardLayoutStore((s) => s.setEditing);

  const snapshot =
    accountSnapshot.length > 0
      ? accountSnapshot
      : [
          ...(call?.industry ? [{ label: "Industry", value: call.industry }] : []),
          { label: "Deal stage", value: call?.dealStage ?? "Discovery" },
        ];

  const shellClass = embedded
    ? "p-4 space-y-4"
    : "p-6 space-y-6 max-w-[1400px] mx-auto w-full";

  if (callLoading || reviewLoading) {
    return (
      <div className={shellClass}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className={embedded ? "p-4" : "p-6 max-w-5xl mx-auto"}>
        <EmptyState title="Call not found" action={{ label: "Back to calls", href: "/calls" }} />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              href={`/calls/${callId}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border hover:bg-muted"
              aria-label="Back to call brief"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground truncate">
                  Post-DC review
                </h1>
                <Badge variant="secondary" className="text-[10px]">
                  Call wrap-up
                </Badge>
                {call.status === "completed" && (
                  <Badge variant="success" className="text-[10px]">
                    Completed
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5 truncate">
                {call.accountName}
                {call.leadName ? ` · ${call.leadName}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {isEditingLayout ? (
              <Button type="button" size="sm" onClick={() => setEditingLayout(false)}>
                Done
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setEditingLayout(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Customize layout
              </Button>
            )}
            <CallWrapUpActions
              callId={callId}
              hasReview={Boolean(review)}
              showLiveLink
              className="shrink-0"
            />
          </div>
        </div>
      )}
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Post-DC wrap-up</p>
          <CallWrapUpActions
            callId={callId}
            hasReview={Boolean(review)}
            variant="compact"
          />
        </div>
      )}

      {justWrapped && (
        <div
          className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 flex items-start gap-3"
          role="status"
        >
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">Call wrapped up</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Post-call artifacts below — headline, summary, BANT learnings, pod scorecard, and
              discovery gaps from the conversation.
            </p>
          </div>
        </div>
      )}

      {!review ? (
        <div className="space-y-4">
          <EmptyState
            icon={FileSpreadsheet}
            title="No Post-DC review yet"
            description="End the call to generate a review, or import post_dc_notes_data.csv in Settings for imported accounts."
            action={{ label: "Back to brief", href: `/calls/${callId}` }}
          />
          <div className="flex justify-center">
            <CallWrapUpActions callId={callId} hasReview={false} />
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Radio className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            <span>
              This is what the pod sees after the discovery call — use it for follow-up email,
              CRM tasks, and proposal work.
            </span>
          </div>
          <LayoutControls
            layoutKey="post-dc"
            widgets={POST_DC_WIDGETS}
            widgetProps={normalizePostDcWidgetProps({
              review,
              call,
              accountSnapshot: snapshot,
            })}
          />
          <CallDetailColumnLayout
            layoutKey="post-dc"
            widgets={POST_DC_WIDGETS}
            widgetProps={normalizePostDcWidgetProps({
              review,
              call,
              accountSnapshot: snapshot,
            })}
          />
        </>
      )}
    </div>
  );
}
