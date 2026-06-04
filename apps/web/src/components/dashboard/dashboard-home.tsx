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
import { DashboardClpActivity } from "./dashboard-clp-activity";
import { PageShell } from "@/components/layout/page-shell";
import { DashboardPageLoader } from "@/components/layout/page-loaders";

export function DashboardHome() {
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);
  const persona = usePersona();

  if (!importsHydrated) {
    return <DashboardPageLoader />;
  }

  if (persona === "leadership") {
    return (
      <PageShell className="space-y-6">
        <AssistantGreeting />
        {!hasImport && <DashboardImportPrompt />}
        <DailyBriefingCard />
        <LeadershipDashboardExtras />
        <QuickActions />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-1.5">
      <AssistantGreeting />
      {!hasImport && <DashboardImportPrompt />}
      <DailyBriefingCard />
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
        <AiTodoList />
        <UnifiedAgenda />
      </div>
      <DashboardClpActivity />
      <QuickActions />
    </PageShell>
  );
}
