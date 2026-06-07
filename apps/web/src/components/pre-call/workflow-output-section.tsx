"use client";

import { Workflow } from "lucide-react";
import { BriefAISummary } from "@/components/pre-call/brief-ai-summary";
import { BriefArtifactsPanel } from "@/components/pre-call/brief-artifacts-panel";
import { BriefContentToGeneratePanel } from "@/components/pre-call/brief-content-to-generate-panel";
import { BriefPreDeckPanel } from "@/components/pre-call/brief-pre-deck-panel";
import { WorkflowAgentBadge } from "@/components/pre-call/workflow-agent-badge";
import type { CallBrief } from "@/lib/brief-types";

interface WorkflowOutputSectionProps {
  brief: CallBrief;
}

/** PRE-DC Workflow output block on the Pre-DC (Pre-call brief) screen. */
export function WorkflowOutputSection({ brief }: WorkflowOutputSectionProps) {
  const hasWorkflowOutput =
    Boolean(brief.aiSummary) ||
    (brief.preDeck?.slides?.length ?? 0) > 0 ||
    (brief.artifactPlan?.length ?? 0) > 0 ||
    (brief.artifactFulfillment?.length ?? 0) > 0 ||
    (brief.contentToGenerate?.length ?? 0) > 0;

  if (!hasWorkflowOutput) return null;

  return (
    <section
      className="rounded-xl border border-primary/20 bg-gradient-to-b from-primary/[0.04] to-transparent p-4 space-y-4"
      aria-labelledby="workflow-output-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Workflow className="h-4 w-4 text-primary shrink-0" />
          <h2 id="workflow-output-heading" className="type-panel-title text-foreground">
            PRE-DC Workflow
          </h2>
          <span className="type-caption text-muted-foreground hidden sm:inline">
            Summary, artifacts &amp; KB fulfillment
          </span>
        </div>
        <WorkflowAgentBadge />
      </div>

      {brief.agentStatus === "failed" && (
        <p className="type-label text-warning rounded-md border border-warning/30 bg-warning/10 px-3 py-2">
          PRE-DC Workflow could not complete for this lead. Re-import or run again from Agents →
          PRE-DC Workflow.
        </p>
      )}

      <BriefAISummary brief={brief} />
      <BriefPreDeckPanel
        deck={brief.preDeck}
        callId={brief.callId}
        accountName={brief.accountName}
      />
      <BriefArtifactsPanel brief={brief} />
      <BriefContentToGeneratePanel items={brief.contentToGenerate} />
    </section>
  );
}
