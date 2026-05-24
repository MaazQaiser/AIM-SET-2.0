"use client";

import { Upload } from "lucide-react";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { AssistantGreeting } from "./assistant-greeting";
import { DailyBriefingCard } from "./daily-briefing-card";
import { AiTodoList } from "./ai-todo-list";
import { UnifiedAgenda } from "./unified-agenda";
import { QuickActions } from "./quick-actions";

export function DashboardHome() {
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-6xl mx-auto">
      <AssistantGreeting />

      {!hasImport ? (
        <EmptyState
          icon={Upload}
          title="Import your leads to get started"
          description="Upload pre_dc_notes_data.csv in Settings. Calls, your agenda, and AI todos use your imported data."
          action={{ label: "Go to data import", href: "/settings" }}
        />
      ) : (
        <>
          <DailyBriefingCard />

          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <AiTodoList />
            <UnifiedAgenda />
          </div>

          <QuickActions />
        </>
      )}
    </div>
  );
}
