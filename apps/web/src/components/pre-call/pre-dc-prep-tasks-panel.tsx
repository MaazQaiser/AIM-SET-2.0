"use client";

import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  BRIEF_SIDEBAR_CARD_SCROLL_MAX,
  briefCardShellClass,
  briefSidebarScrollClass,
} from "@/components/pre-call/brief-detail-card";
import { DiscoveryChecklistPanel } from "@/components/live/discovery-checklist-panel";
import { seedChecklistFromCall } from "@/lib/discovery-checklist-seed";
import type { BriefWidgetProps } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";

interface PreDcPrepTasksPanelProps {
  widgetProps: BriefWidgetProps;
}

/** Left sidebar: discovery checklist only (BANT lives in page header strip). */
export function PreDcPrepTasksPanel({ widgetProps }: PreDcPrepTasksPanelProps) {
  const checklist = seedChecklistFromCall(widgetProps.call);

  if (!checklist) return null;

  return (
    <Card
      className={cn(briefCardShellClass, "flex min-h-0 flex-col")}
      style={{ maxHeight: BRIEF_SIDEBAR_CARD_SCROLL_MAX }}
    >
      <CardHeader className="sticky top-0 z-10 shrink-0 bg-card px-7 pt-6 pb-3">
        <CardTitle className="text-base font-extrabold tracking-tight flex items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-foreground" />
          Discovery checklist
        </CardTitle>
      </CardHeader>
      <CardContent
        className={cn(
          briefSidebarScrollClass,
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-7 pb-6 pt-3"
        )}
      >
        <DiscoveryChecklistPanel
          state={checklist}
          variant="brief"
          embedded
          suppressBantSections
        />
      </CardContent>
    </Card>
  );
}
