"use client";

import Link from "next/link";
import { ArrowUpRight, FileCheck, FileQuestion, FileSearch, Package } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  BriefDetailCard,
  briefMainBody,
  briefMainLead,
  briefMainMuted,
  briefMainUnderline,
} from "@/components/pre-call/brief-detail-card";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { buildArtifactStudioHref } from "@/lib/content-studio/artifact-studio-href";
import type { CallBrief, PlannedArtifactType } from "@/lib/brief-types";
import type { KbFileFormat } from "@/lib/kb/file-format";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

function artifactTypeToFormat(type: PlannedArtifactType): KbFileFormat {
  if (type === "deck") return "pptx";
  if (type === "case_study" || type === "one_pager") return "pdf";
  return "pdf";
}

function ArtifactTypeIcon({
  type,
  className,
}: {
  type: PlannedArtifactType;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[46px] w-[46px] shrink-0 items-center justify-center self-center rounded-full",
        "border border-border/70 bg-muted/30 shadow-sm",
        className
      )}
    >
      <KbFileTypeIcon format={artifactTypeToFormat(type)} className="h-7 w-6" />
    </div>
  );
}

interface BriefArtifactsPanelProps {
  brief: CallBrief;
  /** Optional call context for Content Studio deep links (lead name) */
  call?: Call;
  /** Body only — used inside tabbed Discovery Call Artifacts card */
  embedded?: boolean;
  /** When embedded in tabbed panel — show one artifact section per tab */
  section?: BriefArtifactsSection;
}

function ArtifactGenerateButton({
  type,
  assetName,
  brief,
  leadName,
}: {
  type: PlannedArtifactType;
  assetName: string;
  brief: CallBrief;
  leadName?: string;
}) {
  const href = buildArtifactStudioHref({
    type,
    callId: brief.callId,
    accountName: brief.accountName,
    leadName,
    assetName,
  });

  return (
    <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2.5 type-label">
      <Link href={href} className="inline-flex items-center gap-1">
        Generate content
        <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
      </Link>
    </Button>
  );
}

export type BriefArtifactsSection = "all" | "plan" | "suggest";

function artifactsEmptyMessage(section: BriefArtifactsSection): string {
  if (section === "plan") {
    return "No artifacts planned for this call yet.";
  }
  if (section === "suggest") {
    return "No missing artifacts for this call yet.";
  }
  return "No artifacts planned for this call yet.";
}

function StatusIcon({ status }: { status: string }) {
  if (status === "found") return <FileCheck className="h-3.5 w-3.5 text-emerald-700" />;
  if (status === "partial") return <FileSearch className="h-3.5 w-3.5 text-amber-700" />;
  return <FileQuestion className="h-3.5 w-3.5 text-rose-700" />;
}

export function BriefArtifactsPanel({
  brief,
  call,
  embedded = false,
  section = "all",
}: BriefArtifactsPanelProps) {
  const leadName = call?.leadName;
  const plan = brief.artifactPlan ?? [];
  const fulfillment = brief.artifactFulfillment ?? [];
  const showPlan = section === "all" || section === "plan";
  const showSuggest = section === "all" || section === "suggest";
  const visiblePlan = showPlan ? plan : [];
  const visibleFulfillment = showSuggest ? fulfillment : [];

  const isEmpty = visiblePlan.length === 0 && visibleFulfillment.length === 0;

  const body = (
    <div className="space-y-4 min-w-0">
      {brief.agentStatus === "failed" && (section === "all" || section === "plan") && (
        <p className="type-label text-warning rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          PRE-DC Workflow could not complete artifact planning. Re-import the lead or re-run from
          Agents → PRE-DC Workflow.
        </p>
      )}

      {visiblePlan.length > 0 && (
        <div className="space-y-2">
          {section === "all" ? (
            <p className="type-label text-muted-foreground">Planned for this call</p>
          ) : null}
          <ol className="list-none space-y-3">
            {visiblePlan
              .slice()
              .sort((a, b) => a.priority - b.priority)
              .map((item) => (
                <li key={item.id} className={cn(briefMainBody, "flex items-center gap-3")}>
                  <ArtifactTypeIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <p className={cn(briefMainLead, briefMainUnderline)}>{item.name}</p>
                    {item.rationale ? (
                      <p className={cn(briefMainMuted, "mt-1")}>{item.rationale}</p>
                    ) : null}
                  </div>
                </li>
              ))}
          </ol>
        </div>
      )}

      {visibleFulfillment.length > 0 && (
        <div className="space-y-2">
          {section === "all" ? (
            <p className="type-label text-muted-foreground">Missing Artifacts</p>
          ) : null}
          <p className={cn(briefMainMuted, "type-body")}>
            Suggested content by Sales Co-pilot for this call.
          </p>
          <ul className="space-y-3">
            {visibleFulfillment.map((row) => {
              const planned = plan.find((p) => p.id === row.artifactId);
              const label = row.name || planned?.name || row.artifactId;
              const whyNeeded =
                planned?.rationale?.trim() ||
                row.requiredData?.replace(/^Needed:\s*/i, "").trim() ||
                "";
              const artifactType = planned?.type ?? "deck";

              return (
                <li
                  key={row.artifactId}
                  className="space-y-2 border-b border-border/40 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      <StatusIcon status={row.status} />
                      <span className={cn(briefMainLead, "break-words")}>{label}</span>
                    </div>
                    <ArtifactGenerateButton
                      type={artifactType}
                      assetName={label}
                      brief={brief}
                      leadName={leadName}
                    />
                  </div>
                  {row.snippet ? (
                    <p
                      className={cn(
                        briefMainBody,
                        briefMainMuted,
                        "border-l-2 border-primary/30 pl-2"
                      )}
                    >
                      {row.snippet}
                    </p>
                  ) : null}
                  {whyNeeded ? (
                    <p className="type-caption text-muted-foreground line-clamp-1">{whyNeeded}</p>
                  ) : null}
                  {row.assetId ? (
                    <p className="type-caption font-mono text-muted-foreground">KB: {row.assetId}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {isEmpty && embedded ? (
        <p className="type-body text-muted-foreground">{artifactsEmptyMessage(section)}</p>
      ) : null}
    </div>
  );

  if (embedded) {
    return body;
  }

  if (isEmpty) {
    return null;
  }

  return (
    <BriefDetailCard
      tone="main"
      title="Discovery Call Artifacts"
      icon={Package}
      sourceInfo={{
        source: "AI plan + KB check",
        detail:
          "First, AI decides which assets would help this call. Then the workflow checks the KB and marks each item as found, partial, or missing.",
      }}
    >
      {body}
    </BriefDetailCard>
  );
}
