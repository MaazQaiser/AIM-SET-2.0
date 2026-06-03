"use client";

import { useDcImportsStore } from "@/stores/use-dc-imports";
import { usePersona } from "@/hooks/use-persona";
import { AssistantGreeting } from "./assistant-greeting";
import { DailyBriefingCard } from "./daily-briefing-card";
import { AiTodoList } from "./ai-todo-list";
import { UnifiedAgenda } from "./unified-agenda";
import { QuickActions } from "./quick-actions";
import { LeadershipDashboardExtras } from "./leadership-dashboard";
import { DashboardImportPrompt } from "./dashboard-import-prompt";
import { DashboardSkeletonSections } from "./dashboard-skeleton-sections";
import { DashboardClpActivity } from "./dashboard-clp-activity";
import { PageShell } from "@/components/layout/page-shell";

export function DashboardHome() {
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);
  const persona = usePersona();

  if (persona === "leadership") {
    return (
      <PageShell className="space-y-6">
        <AssistantGreeting />
        {!hasImport && <DashboardImportPrompt />}
        {hasImport ? (
          <>
            <DailyBriefingCard />
            <LeadershipDashboardExtras />
            <QuickActions />
          </>
        ) : (
          <DashboardSkeletonSections />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-1.5">
      <AssistantGreeting />

      {!hasImport && <DashboardImportPrompt />}

      {hasImport ? (
        <>
          <DailyBriefingCard />
          <div className="grid gap-1.5 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <AiTodoList />
            <UnifiedAgenda />
          </div>
          <DashboardClpActivity />
          <QuickActions />
        </>
      ) : (
        <>
          <DashboardSkeletonSections />
          <QuickActions />
        </>
      )}
    </PageShell>
  );
}
