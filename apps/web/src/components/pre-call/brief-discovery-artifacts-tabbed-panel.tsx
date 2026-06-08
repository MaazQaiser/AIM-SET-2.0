"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FolderKanban, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
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

type RelevantContentTab = "documents" | "projects";

interface BriefDiscoveryArtifactsTabbedPanelProps {
  brief: CallBrief;
  call: Call;
}

const TABS_LIST_CLASS = cn(
  "relative z-10 mb-4 h-auto min-h-10 w-full shrink-0 justify-start gap-6 overflow-x-auto rounded-none",
  "border-b border-border/60 bg-card px-0"
);

function relevantDocumentCount(brief: CallBrief): number {
  const documents = brief.relevantDocuments ?? [];
  if (!brief.recommendedDeck) return documents.length;
  const duplicateDeckCount = documents.some((doc) => doc.assetId === brief.recommendedDeck?.assetId)
    ? 0
    : 1;
  return documents.length + duplicateDeckCount;
}

function resolveDefaultTab(brief: CallBrief): RelevantContentTab {
  const documentCount = relevantDocumentCount(brief);
  const projectCount = brief.relevantProjects?.length ?? 0;
  if (projectCount > 0 && documentCount === 0) return "projects";
  return "documents";
}

export function BriefDiscoveryArtifactsTabbedPanel({
  brief,
  call,
}: BriefDiscoveryArtifactsTabbedPanelProps) {
  const userSelectedTabRef = useRef(false);
  const [activeTab, setActiveTab] = useState<RelevantContentTab>(() => resolveDefaultTab(brief));
  const { merged, loading } = useRelevantContentBrief(call.id, brief);
  const resolvedTab = useMemo(() => resolveDefaultTab(merged), [merged]);
  const documentCount = relevantDocumentCount(merged);
  const projectCount = merged.relevantProjects?.length ?? 0;

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
      title="Relevant content"
      icon={FolderKanban}
      scrollMaxHeight={BRIEF_RELEVANT_CONTENT_SCROLL_MAX}
      sourceInfo={{
        source: "Knowledge base search",
        detail:
          "This shows ranked, previewable content pulled from the knowledge base: presentations and documents, plus project details when they match the account and call context.",
      }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          userSelectedTabRef.current = true;
          setActiveTab(value as RelevantContentTab);
        }}
        className="min-w-0"
      >
        <TabsList className={TABS_LIST_CLASS}>
          <TabsTrigger value="documents" className="type-label">
            Presentations & docs
            {documentCount > 0 ? (
              <span className="ml-1 type-caption tabular-nums text-muted-foreground">
                {documentCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="projects" className="type-label">
            Project details
            {projectCount > 0 ? (
              <span className="ml-1 type-caption tabular-nums text-muted-foreground">
                {projectCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="m-0 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 type-body text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin text-foreground" />
              Loading presentations and documents from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="documents" />
          )}
        </TabsContent>

        <TabsContent value="projects" className="m-0 focus-visible:outline-none">
          {loading ? (
            <div className="flex items-center gap-2 type-body text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin text-foreground" />
              Loading project details from knowledge base…
            </div>
          ) : (
            <BriefRelevantContent brief={merged} embedded section="projects" />
          )}
        </TabsContent>
      </Tabs>
    </BriefDetailCard>
  );
}
