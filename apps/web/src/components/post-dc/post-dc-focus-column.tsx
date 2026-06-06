"use client";

import { PostDcBantPanel } from "@/components/post-dc/post-dc-bant-panel";
import { PostDcDealSignalsBar } from "@/components/post-dc/post-dc-deal-signals-bar";
import { PostDcEmailJiraPanel } from "@/components/post-dc/post-dc-email-jira-panel";
import { PostSummaryCard } from "@/components/post-dc/post-dc-widget-cards";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import { resolveDealSignals, resolveLeadStage } from "@/lib/post-dc/deal-signals";
import { getPostDcRecommendation } from "@/lib/post-dc/workflow-tasks";
import {
  type PostDcWidgetProps,
  type WidgetSpec,
} from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";

interface PostDcFocusColumnProps {
  widgetProps: PostDcWidgetProps;
  secondaryWidgets: WidgetSpec<PostDcWidgetProps>[];
  onHide: (id: string) => void;
}

/** Post-DC main column: summary → BANT | signals → email | Jira. Tasks live in the right rail. */
export function PostDcFocusColumn({
  widgetProps,
  secondaryWidgets,
  onHide,
}: PostDcFocusColumnProps) {
  const {
    review,
    bant,
    emailDraft,
    internalEmailDraft,
    jiraTicket,
    onCreateJiraTicket,
  } = widgetProps;
  const leadStage = widgetProps.leadStage ?? resolveLeadStage(review);
  const signals = resolveDealSignals(review);
  const recommendation = getPostDcRecommendation(review);

  return (
    <div className={cn("flex min-w-0 flex-col gap-5")}>
      <div id="post-dc-widget-post.summary" className="scroll-mt-28 min-w-0">
        <PostSummaryCard
          summary={review.summary ?? []}
          recommendation={recommendation}
          review={review}
          deadlineNote={signals.additionalInfo}
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-4",
          bant && "md:grid-cols-2"
        )}
      >
        {bant ? (
          <div id="post-dc-widget-post.bant" className="min-w-0 flex flex-col">
            <PostDcBantPanel bant={bant} review={review} />
          </div>
        ) : null}
        <div id="post-dc-widget-post.deal_signals" className="min-w-0 flex flex-col">
          <PostDcDealSignalsBar signals={signals} leadStage={leadStage} className="flex-1" />
        </div>
      </div>

      <div id="post-dc-widget-post.email_jira_handoff" className="scroll-mt-28 min-w-0">
        <PostDcEmailJiraPanel
          emailDraft={emailDraft}
          internalEmailDraft={internalEmailDraft}
          jiraTicket={jiraTicket}
          onCreateJiraTicket={onCreateJiraTicket}
          parallelCards
        />
      </div>

      {secondaryWidgets.length > 0 ? (
        <div className="flex flex-col gap-5 min-w-0">
          {secondaryWidgets.map((spec) => (
            <div key={spec.id} id={`post-dc-widget-${spec.id}`} className="scroll-mt-28 min-w-0">
              <DashboardWidget
                title={spec.title}
                isEditing={false}
                columnZone="center"
                onHide={() => onHide(spec.id)}
              >
                {spec.render(widgetProps)}
              </DashboardWidget>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
