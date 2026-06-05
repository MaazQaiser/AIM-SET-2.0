"use client";

import { Fragment, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { PostDcProposalWidget } from "@/components/post-dc/post-dc-proposal-widget";
import { JiraTicketCard } from "@/components/post-dc/jira-ticket-card";
import { PostDcClpActivityCard } from "@/components/post-dc/post-dc-clp-activity-card";
import { PostDcClpStatusCard } from "@/components/post-dc/post-dc-clp-status-card";
import { PostDcTranscriptPanel } from "@/components/post-dc/post-dc-transcript-panel";
import {
  POST_DC_TAB_GROUP_LABELS,
  POST_DC_TAB_ITEMS,
  POST_DC_TAB_JOURNEY,
  POST_DC_TAB_WIDGET_IDS,
  type PostDcTabId,
} from "@/components/post-dc/post-dc-tab-config";
import type { PostDcWidgetProps, WidgetSpec } from "@/lib/dashboard/widget-registry";
import type { PostCallJiraTicket } from "@/lib/brief-types";
import { cn } from "@/lib/cn";
import { useDashboardLayoutStore } from "@/stores/use-dashboard-layout";
import type { CustomerLandingPage } from "@dc-copilot/types";

const EMPTY_HIDDEN: string[] = [];

interface PostDcTabbedContentProps {
  callId: string;
  widgets: WidgetSpec<PostDcWidgetProps>[];
  widgetProps: PostDcWidgetProps;
  landingPage?: CustomerLandingPage | null;
  jiraTicket?: PostCallJiraTicket | null;
  onCreateJiraTicket?: (ticket: PostCallJiraTicket) => Promise<void> | void;
  embedded?: boolean;
  defaultTab?: PostDcTabId;
  onTabChange?: (tab: PostDcTabId) => void;
}

export function PostDcTabbedContent({
  callId,
  widgets,
  widgetProps,
  landingPage,
  jiraTicket,
  onCreateJiraTicket,
  embedded = false,
  defaultTab,
  onTabChange,
}: PostDcTabbedContentProps) {
  const initialTab = defaultTab ?? (embedded ? "summary" : "before");
  const [activeTab, setActiveTab] = useState<PostDcTabId>(initialTab);
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
    if (tabId === "transcript") {
      return true;
    }
    if (tabId === "proposal") {
      return true;
    }
    if (tabId === "jira") {
      return Boolean(jiraTicket);
    }
    if (tabId === "landing") {
      return visibleByTab.landing.length > 0 || Boolean(landingPage);
    }
    return visibleByTab[tabId].length > 0;
  };

  function handleTabChange(tab: PostDcTabId) {
    setActiveTab(tab);
    onTabChange?.(tab);
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => handleTabChange(v as PostDcTabId)}
      className="min-w-0 space-y-4"
    >
      <TabsList
        className={cn(
          "h-10 w-full shrink-0 justify-start overflow-x-auto rounded-none border-b border-border/60 bg-transparent px-0",
          embedded && "h-9"
        )}
      >
        {POST_DC_TAB_ITEMS.map((tab, index) => {
          const previous = POST_DC_TAB_ITEMS[index - 1];
          const showGroupLabel = tab.group !== previous?.group;

          return (
            <Fragment key={tab.id}>
              {showGroupLabel ? (
                <span
                  className="px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground self-center shrink-0 select-none"
                  aria-hidden
                >
                  {POST_DC_TAB_GROUP_LABELS[tab.group]}
                </span>
              ) : null}
              <TabsTrigger
                value={tab.id}
                className={cn("text-xs", !tabHasContent(tab.id) && "opacity-60")}
              >
                {tab.label}
              </TabsTrigger>
            </Fragment>
          );
        })}
      </TabsList>

      <p className="text-xs text-muted-foreground">{POST_DC_TAB_JOURNEY[activeTab]}</p>

      <TabsContent value="before" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.before}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Import post-DC notes or run wrap-up to populate pre-call context."
        />
      </TabsContent>

      <TabsContent value="summary" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.summary}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Run wrap-up to generate the call summary."
        />
      </TabsContent>

      <TabsContent value="next-steps" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab["next-steps"]}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Recommended next steps and CRM tasks appear here after wrap-up."
        />
      </TabsContent>

      <TabsContent value="transcript" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcTranscriptPanel callId={callId} />
      </TabsContent>

      <TabsContent value="coaching" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.coaching}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Pod member coaching scorecards appear here after wrap-up."
        />
      </TabsContent>

      <TabsContent value="follow-up" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab["follow-up"]}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Follow-up emails appear here after wrap-up."
        />
      </TabsContent>

      <TabsContent value="content" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcWidgetRail
          widgets={visibleByTab.content}
          widgetProps={widgetProps}
          onHide={(id) => hideWidget("post-dc", id)}
          emptyMessage="Suggest Content and Missing content sections appear here after wrap-up."
        />
      </TabsContent>

      <TabsContent value="proposal" className="m-0 space-y-4 focus-visible:outline-none">
        <PostDcProposalWidget callId={callId} />
      </TabsContent>

      <TabsContent value="jira" className="m-0 space-y-4 focus-visible:outline-none">
        {jiraTicket ? (
          <JiraTicketCard ticket={jiraTicket} onCreate={onCreateJiraTicket} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Run wrap-up to generate a Jira ticket draft for this call.
          </p>
        )}
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
    <div className="flex w-full min-w-0 flex-col gap-4">
      {widgets.map((spec) => (
        <div key={spec.id} className="w-full min-w-0">
          {spec.render(widgetProps)}
        </div>
      ))}
    </div>
  );
}

export { POST_DC_TAB_JOURNEY };
