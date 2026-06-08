"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";
import { ContentProjectsTab } from "@/components/content/content-projects-tab";
import { ContentLibraryTab } from "@/components/content/content-library-tab";
import { ContentSuggestionsTab } from "@/components/content/content-suggestions-tab";
import { ContentTemplatesTab } from "@/components/content/content-templates-tab";
import { ContentDraftsTab } from "@/components/content/content-drafts-tab";
import {
  useContentManagerSidebarStats,
  useKbAssets,
} from "@/lib/data/hooks";
import { useContentTemplates } from "@/lib/data/content-studio-hooks";
import { usePersona } from "@/hooks/use-persona";

export type KnowledgeBaseTab = "projects" | "library" | "suggestions" | "templates" | "studio";

const TAB_LABELS: Record<KnowledgeBaseTab, string> = {
  projects: "Projects",
  library: "Content Library",
  suggestions: "Content Suggestions",
  templates: "Templates",
  studio: "Content Studio",
};

function normalizeTabParam(tabParam: string | null): KnowledgeBaseTab | null {
  if (
    tabParam === "projects" ||
    tabParam === "library" ||
    tabParam === "suggestions" ||
    tabParam === "templates" ||
    tabParam === "studio"
  ) {
    return tabParam;
  }
  if (tabParam === "drafts") return "studio";
  return null;
}

function resolveDefaultTab(
  tabParam: string | null,
  libraryTabParam: string | null,
  persona: string,
  suggestionCount: number
): KnowledgeBaseTab {
  const normalized = normalizeTabParam(tabParam);
  if (normalized) return normalized;
  if (libraryTabParam === "projects") return "projects";
  if (persona === "content-owner" || persona === "leadership") return "library";
  if (suggestionCount > 0) return "suggestions";
  return "library";
}

export function ContentHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const persona = usePersona();
  const { data: assets = [], isLoading: assetsLoading } = useKbAssets();
  const { data: templates = [] } = useContentTemplates();
  const { toGenerateCount } = useContentManagerSidebarStats();

  const tabParam = searchParams.get("tab");
  const libraryTabParam = searchParams.get("libraryTab");

  const resolvedTab = useMemo(
    () =>
      resolveDefaultTab(tabParam, libraryTabParam, persona, toGenerateCount),
    [tabParam, libraryTabParam, persona, toGenerateCount]
  );

  const [activeTab, setActiveTab] = useState<KnowledgeBaseTab>(resolvedTab);
  const [libraryDetailOpen, setLibraryDetailOpen] = useState(false);

  useEffect(() => {
    setActiveTab(resolvedTab);
  }, [resolvedTab]);

  function onTabChange(next: string) {
    const tab = next as KnowledgeBaseTab;
    setActiveTab(tab);
    router.replace(`/content?tab=${tab}`, { scroll: false });
  }

  const hideHubChrome = libraryDetailOpen && activeTab === "library";

  return (
    <PageShell
      size="wide"
      className={hideHubChrome ? "!max-w-none !p-0 !space-y-0 h-full min-h-0" : undefined}
    >
      {!hideHubChrome ? (
        <PageHeader className="flex flex-col items-start gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="type-page-title text-foreground">Knowledge Base</h1>
            <p className="mt-1 type-body-sm text-muted-foreground">
              {assetsLoading && assets.length === 0
                ? "Loading assets..."
                : `${assets.length} approved assets`}
              {templates.length > 0 && (
                <span> · {templates.length} template{templates.length === 1 ? "" : "s"}</span>
              )}
              {toGenerateCount > 0 && (
                <span> · {toGenerateCount} to generate</span>
              )}
              {process.env.NEXT_PUBLIC_KB_SHARED === "true" && (
                <span className="ml-1">· Shared team library</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <KbUploadButton />
          </div>
        </PageHeader>
      ) : null}

      <Tabs value={activeTab} onValueChange={onTabChange} variant="underline">
        {!hideHubChrome ? (
          <TabsList>
            <TabsTrigger value="projects">{TAB_LABELS.projects}</TabsTrigger>
            <TabsTrigger value="library">{TAB_LABELS.library}</TabsTrigger>
            <TabsTrigger value="suggestions">
              {TAB_LABELS.suggestions}
              {toGenerateCount > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 type-caption font-medium tabular-nums text-primary">
                  {toGenerateCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates">{TAB_LABELS.templates}</TabsTrigger>
            <TabsTrigger value="studio">{TAB_LABELS.studio}</TabsTrigger>
          </TabsList>
        ) : null}

        {!hideHubChrome ? (
          <>
            <TabsContent value="projects">
              <ContentProjectsTab />
            </TabsContent>
            <TabsContent value="suggestions">
              <ContentSuggestionsTab />
            </TabsContent>
            <TabsContent value="templates">
              <ContentTemplatesTab />
            </TabsContent>
            <TabsContent value="studio">
              <ContentDraftsTab />
            </TabsContent>
          </>
        ) : null}

        <TabsContent value="library" className={hideHubChrome ? "mt-0" : undefined}>
          <ContentLibraryTab onDetailModeChange={setLibraryDetailOpen} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
