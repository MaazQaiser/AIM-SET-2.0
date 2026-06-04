"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import { PostDcProposalWidget } from "@/components/post-dc/post-dc-proposal-widget";
import { PostDcClpActivityCard } from "@/components/post-dc/post-dc-clp-activity-card";
import { PostDcClpStatusCard } from "@/components/post-dc/post-dc-clp-status-card";
import {
  POST_DC_TAB_ITEMS,
  POST_DC_TAB_WIDGET_IDS,
  type PostDcTabId,
} from "@/components/post-dc/post-dc-tab-config";
import type { PostDcWidgetProps, WidgetSpec } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import type { CustomerLandingPage } from "@dc-copilot/types";

const EMPTY_HIDDEN: string[] = [];

interface PostDcTabbedContentProps {
  callId: string;
  widgets: WidgetSpec<PostDcWidgetProps>[];
  widgetProps: PostDcWidgetProps;
  landingPage?: CustomerLandingPage | null;
  /** Proposal / KB attachment panels (follow-up tab extras) */
  followUpExtras?: React.ReactNode;
  embedded?: boolean;
}

export function PostDcTabbedContent({
  callId,
  widgets,
  widgetProps,
  landingPage,
  followUpExtras,
  embedded = false,
}: PostDcTabbedContentProps) {
  const [activeTab, setActiveTab] = useState<PostDcTabId>("outcomes");
  const hidden = useDashboardLayoutStore((s) => s.hidden["post-dc"] ?? EMPTY_HIDDEN);
  const hideWidget = useDashboardLayoutStore((s) => s.hideWidget);

  const visibleByTab = useMemo(() => {
    const available = widgets.filter((w) => {
      if (hidden.includes(w.id)) return false;
      if (w.isAvailable && !w.isAvailable(widgetProps)) return false;
      return true;
    });
    const byId = new Map(available.map((w) => [w.id, w]));

    return POST_DC_TAB_ITEMS.reduce(
      (acc, tab) => {
        acc[tab.id] = POST_DC_TAB_WIDGET_IDS[tab.id]
          .map((id) => byId.get(id))
          .filter((w): w is WidgetSpec<PostDcWidgetProps> => Boolean(w));
        return acc;
      },
      {} as Record<PostDcTabId, WidgetSpec<PostDcWidgetProps>[]>
    );
  }, [widgets, hidden, widgetProps]);

  const tabHasContent = (tabId: PostDcTabId) => {
    if (tabId === "follow-up") {
      return visibleByTab["follow-up"].length > 0 || Boolean(followUpExtras);
    }
    if (tabId === "landing") {
      return visibleByTab.landing.length > 0 || Boolean(landingPage);
    }
    return visibleByTab[tabId].length > 0;
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as PostDcTabId)}
      className="min-w-0 space-y-4"
    >
      <TabsList
        className={cn(
          "h-10 w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-border/60 bg-transparent px-0",
          embedded && "h-9"
        )}
      >
        {POST_DC_TAB_ITEMS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn("text-xs", !tabHasContent(tab.id) && "opacity-60")}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="outcomes" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.outcomes}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="No outcome cards yet. Run wrap-up or import post-DC notes to populate this tab."
        />
      </TabsContent>

      <TabsContent value="follow-up" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcProposalWidget callId={callId} />
        {followUpExtras}
        <PostDcWidgetRail
          widgets={visibleByTab["follow-up"]}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage={
            followUpExtras
              ? undefined
              : "Follow-up emails and KB suggestions appear here after wrap-up."
          }
        />
      </TabsContent>

      <TabsContent value="actions" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.actions}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="CRM tasks and Jira drafts show up here when the post-call pipeline generates them."
        />
      </TabsContent>

      <TabsContent value="landing" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcClpStatusCard callId={callId} page={landingPage ?? undefined} />
        <PostDcClpActivityCard
          callId={callId}
          enabled={landingPage?.status === "published"}
        />
        <PostDcWidgetRail
          widgets={visibleByTab.landing}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
        />
      </TabsContent>
    </Tabs>
  );
}

function PostDcWidgetRail<P>({
  widgets,
  widgetProps,
  onHide,
  emptyMessage,
}: {
  widgets: WidgetSpec<P>[];
  widgetProps: P;
  onHide: (id: string) => void;
  emptyMessage?: string;
}) {
  if (widgets.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-4 min-w-0">
      {widgets.map((spec) => (
        <DashboardWidget
          key={spec.id}
          title={spec.title}
          isEditing={false}
          columnZone="center"
          onHide={() => onHide(spec.id)}
        >
          {spec.render(widgetProps)}
        </DashboardWidget>
      ))}
    </div>
  );
}
