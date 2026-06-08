"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

const TABS_LIST_CLASS = cn(
  "relative z-10 mb-4 h-auto min-h-10 w-full shrink-0 justify-start gap-6 overflow-x-auto rounded-none",
  "border-b border-border/60 bg-card px-0"
);

function resolveDefaultTab(brief: CallBrief): ArtifactsTab {
  if (brief.recommendedDeck || (brief.relevantDocuments?.length ?? 0) > 0) return "documents";
  if ((brief.relevantProjects?.length ?? 0) > 0) return "projects";
  if ((brief.artifactPlan?.length ?? 0) > 0) return "plan";
  if ((brief.artifactFulfillment?.length ?? 0) > 0) return "suggest";
  return "documents";
}

export function BriefDiscoveryArtifactsTabbedPanel({
  brief,
  call,
}: BriefDiscoveryArtifactsTabbedPanelProps) {
  const userSelectedTabRef = useRef(false);
  const [activeTab, setActiveTab] = useState<ArtifactsTab>(() => resolveDefaultTab(brief));
  const { merged, loading } = useRelevantContentBrief(call.id, brief);
  const resolvedTab = useMemo(() => resolveDefaultTab(merged), [merged]);

  useEffect(() => {
    userSelectedTabRef.current = false;
    setActiveTab(resolveDefaultTab(brief));
  }, [brief]);

  useEffect(() => {
    if (userSelectedTabRef.current) return;
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  return (
    <BriefDetailCard
      tone="main"
      title="Call assets"
      icon={Package}
      scrollMaxHeight={BRIEF_RELEVANT_CONTENT_SCROLL_MAX}
      sourceInfo={{
        source: "AI plan + knowledge base",
        detail:
          "Asset plan lists what the call needs. Content gaps shows planned assets that are missing or only partially found. KB matches and Project matches show ranked supporting material from your knowledge base.",
      }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          userSelectedTabRef.current = true;
          setActiveTab(value as ArtifactsTab);
        }}
        className="min-w-0"
      >
        <TabsList className={TABS_LIST_CLASS}>
          <TabsTrigger value="plan" className="type-label">
            Asset plan
          </TabsTrigger>
          <TabsTrigger value="suggest" className="type-label">
            Content gaps
          </TabsTrigger>
          <TabsTrigger value="documents" className="type-label">
            KB matches
          </TabsTrigger>
          <TabsTrigger value="projects" className="type-label">
            Project matches
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan" className="m-0 focus-visible:outline-none">
          <BriefArtifactsPanel brief={brief} call={call} embedded section="plan" />
        </TabsContent>

        <TabsContent value="suggest" className="m-0 focus-visible:outline-none">
          <BriefArtifactsPanel brief={brief} call={call} embedded section="suggest" />
        </TabsContent>

        <TabsContent value="documents" className="m-0 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 type-body text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading KB matches from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="documents" />
          )}
        </TabsContent>

        <TabsContent value="projects" className="m-0 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 type-body text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading project matches from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="projects" />
          )}
        </TabsContent>
      </Tabs>
    </BriefDetailCard>
  );
}
