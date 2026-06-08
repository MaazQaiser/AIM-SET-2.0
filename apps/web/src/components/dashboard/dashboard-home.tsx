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
import { PageShell } from "@/components/layout/page-shell";

export function DashboardHome() {
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);
  const persona = usePersona();
  const showImportPrompt = importsHydrated && !hasImport;

  if (persona === "leadership") {
    return (
      <PageShell className="space-y-6">
        <AssistantGreeting />
        {showImportPrompt && <DashboardImportPrompt />}
        <DailyBriefingCard enabled={importsHydrated} />
        <LeadershipDashboardExtras />
        <QuickActions />
      </PageShell>
    );
  }

  return (
    <PageShell className="space-y-1.5">
      <AssistantGreeting />
      {showImportPrompt && <DashboardImportPrompt />}
      <DailyBriefingCard enabled={importsHydrated} />
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <AiTodoList />
        <UnifiedAgenda />
      </div>
      <QuickActions />
    </PageShell>
  );
}
