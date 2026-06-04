"use client";

import { useMemo, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { BriefArtifactsPanel } from "@/components/pre-call/brief-artifacts-panel";
import {
  BriefDetailCard,
  BRIEF_RELEVANT_CONTENT_SCROLL_MAX,
} from "@/components/pre-call/brief-detail-card";
import {
  BriefRelevantContent,
  useRelevantContentBrief,
} from "@/components/pre-call/brief-relevant-content";
import type { CallBrief } from "@/lib/brief-types";
import type { Call } from "@/types";
import { cn } from "@/lib/cn";

type ArtifactsTab = "plan" | "suggest" | "documents" | "projects";

interface BriefDiscoveryArtifactsTabbedPanelProps {
  brief: CallBrief;
  call: Call;
}

const STICKY_TABS_LIST_CLASS = cn(
  "sticky top-0 z-10 h-10 w-full shrink-0 justify-start gap-6 overflow-x-auto rounded-none",
  "border-b border-border/60 bg-transparent px-0"
);

function resolveDefaultTab(brief: CallBrief): ArtifactsTab {
  if ((brief.artifactPlan?.length ?? 0) > 0) return "plan";
  if ((brief.artifactFulfillment?.length ?? 0) > 0) return "suggest";
  if ((brief.relevantDocuments?.length ?? 0) > 0) return "documents";
  if ((brief.relevantProjects?.length ?? 0) > 0) return "projects";
  return "plan";
}

export function BriefDiscoveryArtifactsTabbedPanel({
  brief,
  call,
}: BriefDiscoveryArtifactsTabbedPanelProps) {
  const defaultTab = useMemo(() => resolveDefaultTab(brief), [brief]);
  const [activeTab, setActiveTab] = useState<ArtifactsTab>(defaultTab);
  const { merged, loading } = useRelevantContentBrief(call.id, brief);

  return (
    <BriefDetailCard
      tone="main"
      title="Discovery Call Artifacts"
      icon={Package}
      scrollMaxHeight={BRIEF_RELEVANT_CONTENT_SCROLL_MAX}
      sourceInfo={{
        source: "AI plan + knowledge base",
        detail:
          "Planned for this call lists AI-selected assets for the discovery call. Missing Artifacts shows KB gaps (not found or partial). Relevant content and Relevant projects show ranked matches from your knowledge base.",
      }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as ArtifactsTab)}
        className="min-w-0"
      >
        <TabsList className={STICKY_TABS_LIST_CLASS}>
          <TabsTrigger value="plan" className="text-xs">
            Planned for this call
          </TabsTrigger>
          <TabsTrigger value="suggest" className="text-xs">
            Missing Artifacts
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">
            Relevant content
          </TabsTrigger>
          <TabsTrigger value="projects" className="text-xs">
            Relevant projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="m-0 pt-4 focus-visible:outline-none">
          <BriefArtifactsPanel brief={brief} call={call} embedded section="plan" />
        </TabsContent>

        <TabsContent value="suggest" className="m-0 pt-4 focus-visible:outline-none">
          <BriefArtifactsPanel brief={brief} call={call} embedded section="suggest" />
        </TabsContent>

        <TabsContent value="documents" className="m-0 pt-4 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading relevant content from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="documents" />
          )}
        </TabsContent>

        <TabsContent value="projects" className="m-0 pt-4 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading relevant projects from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="projects" />
          )}
        </TabsContent>
      </Tabs>
    </BriefDetailCard>
  );
}
