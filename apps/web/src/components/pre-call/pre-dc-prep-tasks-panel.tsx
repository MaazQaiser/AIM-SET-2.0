"use client";

import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  BRIEF_CARD_LAYOUT_CLASS,
  BRIEF_SIDEBAR_CARD_SCROLL_MAX,
  briefCardShellClass,
  briefScrollBodyClassName,
  briefStickyHeaderClassName,
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
      className={cn(briefCardShellClass, BRIEF_CARD_LAYOUT_CLASS)}
      style={{ maxHeight: BRIEF_SIDEBAR_CARD_SCROLL_MAX }}
    >
      <CardHeader className={briefStickyHeaderClassName}>
        <CardTitle className="type-panel-title flex items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-foreground" />
          Discovery checklist
        </CardTitle>
      </CardHeader>
      <CardContent className={briefScrollBodyClassName("default", true)}>
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
