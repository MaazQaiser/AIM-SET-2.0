"use client";

import { useEffect, useMemo, useRef } from "react";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import {
  buildDefaultColumnOrder,
  mergeColumnOrder,
  orderWidgetsByColumn,
} from "@/lib/dashboard/column-order";
import {
  isBriefTaskWidget,
  isPostDcStructuredWidget,
  type BriefWidgetProps,
  type PostDcWidgetProps,
  type WidgetColumn,
  type WidgetSpec,
} from "@/lib/dashboard/widget-registry";
import { PreDcCustomerInfoPanel } from "@/components/pre-call/pre-dc-customer-info-panel";
import { PreDcPrepTasksPanel } from "@/components/pre-call/pre-dc-prep-tasks-panel";
import { PostDcFocusColumn } from "@/components/post-dc/post-dc-focus-column";
import { PostDcAccountPrepColumn } from "@/components/post-dc/post-dc-account-prep-column";
import { PostDcTranscriptColumn } from "@/components/post-dc/post-dc-transcript-column";
import { PostDcAiCoachColumn } from "@/components/post-dc/post-dc-ai-coach-column";
import { PostDcClientLandingColumn } from "@/components/post-dc/post-dc-client-landing-column";
import { PostDcMainLayout } from "@/components/post-dc/post-dc-main-layout";
import type { PostDcScreenTab } from "@/components/post-dc/post-dc-screen-tabs";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";
import { useDashboardLayoutStore, type LayoutKey } from "@/stores/use-dashboard-layout";
import { EditableColumnGrid } from "@/components/calls/editable-column-grid";
import type { CallBrief } from "@/lib/brief-types";

interface CallDetailColumnLayoutProps<P> {
  layoutKey: LayoutKey;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
  /** Rendered at top of center column (e.g. Join call) */
  centerHeader?: React.ReactNode;
  /** Compact left rail for embedded post-DC (live workspace tab) */
  contextEmbedded?: boolean;
  /** Post-DC right rail — workflow tasks */
  tasksColumn?: React.ReactNode;
  /** Post-DC screen tab */
  postDcScreenTab?: PostDcScreenTab;
  /** Pre-call brief for Lead Overview tab */
  postDcBrief?: CallBrief | null;
}

const COLUMN_LABELS: Record<WidgetColumn, string> = {
  left: "Account & research",
  center: "Discuss & prep",
  right: "Coverage & completion",
};
const EMPTY_HIDDEN: string[] = [];
const EMPTY_WIDGET_HEIGHTS: Record<string, number> = {};

export function CallDetailColumnLayout<P>({
  layoutKey,
  widgets,
  widgetProps,
  centerHeader,
  contextEmbedded = false,
  tasksColumn,
  postDcScreenTab = "overview",
  postDcBrief = null,
}: CallDetailColumnLayoutProps<P>) {
  const isEditing = useDashboardLayoutStore((s) => s.isEditing);
  const hidden = useDashboardLayoutStore((s) => s.hidden[layoutKey] ?? EMPTY_HIDDEN);
  const storedOrder = useDashboardLayoutStore((s) => s.columnOrder[layoutKey]);
  const widgetHeights = useDashboardLayoutStore((s) => s.widgetHeights[layoutKey] ?? EMPTY_WIDGET_HEIGHTS);
  const hideWidget = useDashboardLayoutStore((s) => s.hideWidget);
  const setEditBaseline = useDashboardLayoutStore((s) => s.setEditBaseline);

  const visibleWidgets = useMemo(
    () =>
      widgets.filter((w) => {
        if (hidden.includes(w.id)) return false;
        if (w.isAvailable && !w.isAvailable(widgetProps)) return false;
        return true;
      }),
    [widgets, hidden, widgetProps]
  );

  const visibleIds = useMemo(() => new Set(visibleWidgets.map((w) => w.id)), [visibleWidgets]);

  const defaultOrder = useMemo(
    () => buildDefaultColumnOrder(visibleWidgets),
    [visibleWidgets]
  );

  const columnOrder = useMemo(
    () => mergeColumnOrder(storedOrder, defaultOrder, visibleIds),
    [storedOrder, defaultOrder, visibleIds]
  );

  // Capture the baseline the first time edit mode opens so Reset can restore it.
  const capturedForSession = useRef(false);
  useEffect(() => {
    if (isEditing && !capturedForSession.current) {
      setEditBaseline(layoutKey, { columnOrder, hidden, widgetHeights });
      capturedForSession.current = true;
    }
    if (!isEditing) {
      capturedForSession.current = false;
    }
  }, [isEditing, layoutKey, columnOrder, hidden, widgetHeights, setEditBaseline]);

  // Edit mode: full drag + resize via react-grid-layout.
  if (isEditing) {
    return (
      <EditableColumnGrid
        layoutKey={layoutKey}
        widgets={visibleWidgets}
        widgetProps={widgetProps}
        columnOrder={columnOrder}
      />
    );
  }

  // Pre-DC brief: 2-column layout (info + checklist | main content).
  if (layoutKey === "brief") {
    const briefProps = widgetProps as BriefWidgetProps;
    const grouped = orderWidgetsByColumn(visibleWidgets, columnOrder);
    const infoWidgets = grouped.left;
    const focusWidgets = [
      ...grouped.center,
      ...grouped.right.filter((w) => !isBriefTaskWidget(w.id)),
    ];

    return (
      <div className="space-y-4 min-w-0">
        <div
          className={cn(
            "grid gap-8",
            "grid-cols-1",
            "lg:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]",
            "lg:items-start"
          )}
        >
          <aside
            className={cn(
              "flex min-w-0 flex-col gap-5",
              "lg:sticky lg:top-2 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto"
            )}
            aria-label="Account context and checklist"
          >
            <PreDcCustomerInfoPanel
              widgets={infoWidgets as WidgetSpec<BriefWidgetProps>[]}
              widgetProps={briefProps}
            />
            <PreDcPrepTasksPanel widgetProps={briefProps} />
          </aside>
          <ColumnRail
            zone="center"
            label=""
            widgets={focusWidgets}
            widgetProps={widgetProps}
            onHide={(id) => hideWidget(layoutKey, id)}
            isPrimary
          />
        </div>
      </div>
    );
  }

  // Post-DC: 2-column layout (main | AI chat) — context lives in Lead Overview tab.
  if (layoutKey === "post-dc") {
    const postDcProps = widgetProps as PostDcWidgetProps;
    const grouped = orderWidgetsByColumn(visibleWidgets, columnOrder);
    const focusWidgets = [...grouped.center, ...grouped.right];
    const secondaryWidgets = focusWidgets.filter((w) => !isPostDcStructuredWidget(w.id));

    const mainContent = (() => {
      switch (postDcScreenTab) {
        case "account-prep":
          return <PostDcAccountPrepColumn widgetProps={postDcProps} brief={postDcBrief} />;
        case "client-landing":
          return <PostDcClientLandingColumn callId={postDcProps.callId} />;
        case "transcript":
          return <PostDcTranscriptColumn callId={postDcProps.callId} />;
        case "coach":
          return <PostDcAiCoachColumn review={postDcProps.review} />;
        case "overview":
        default:
          return (
            <PostDcFocusColumn
              widgetProps={postDcProps}
              secondaryWidgets={secondaryWidgets as WidgetSpec<PostDcWidgetProps>[]}
              onHide={(id) => hideWidget(layoutKey, id)}
            />
          );
      }
    })();

    return (
      <PostDcMainLayout tasksColumn={tasksColumn} embedded={contextEmbedded}>
        {mainContent}
      </PostDcMainLayout>
    );
  }

  // Other layouts: 3-column view.
  const grouped = orderWidgetsByColumn(visibleWidgets, columnOrder);

  return (
    <div
      className={cn(
        "grid gap-4",
        "grid-cols-1",
        "lg:grid-cols-[minmax(220px,0.22fr)_minmax(0,1fr)_minmax(240px,0.28fr)]",
        "lg:items-start"
      )}
    >
      <ColumnRail
        zone="left"
        label={COLUMN_LABELS.left}
        widgets={grouped.left}
        widgetProps={widgetProps}
        onHide={(id) => hideWidget(layoutKey, id)}
      />
      <ColumnRail
        zone="center"
        label={COLUMN_LABELS.center}
        widgets={grouped.center}
        widgetProps={widgetProps}
        onHide={(id) => hideWidget(layoutKey, id)}
        header={centerHeader}
        isPrimary
      />
      <ColumnRail
        zone="right"
        label={COLUMN_LABELS.right}
        widgets={grouped.right}
        widgetProps={widgetProps}
        onHide={(id) => hideWidget(layoutKey, id)}
      />
    </div>
  );
}

function ColumnSectionLabel({ label }: { label: string }) {
  const { isIntercom } = useThemePreview();
  if (!isIntercom || !label.trim()) return null;

  return (
    <p className="text-xs font-medium text-muted-foreground pb-1 border-b border-border mb-1">
      {label}
    </p>
  );
}

function ColumnRail<P>({
  zone,
  label,
  widgets,
  widgetProps,
  onHide,
  header,
  isPrimary,
}: {
  zone: WidgetColumn;
  label: string;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
  onHide: (id: string) => void;
  header?: React.ReactNode;
  isPrimary?: boolean;
}) {
  const { isIntercom } = useThemePreview();
  if (widgets.length === 0 && !header) return null;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col",
        isIntercom ? "gap-4" : "gap-3",
        zone === "center"
          ? "min-h-0"
          : "lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      )}
      aria-label={label}
    >
      <ColumnSectionLabel label={label} />
      {header}
      <div className={cn("flex flex-col min-w-0", isIntercom ? "gap-4" : "gap-3", isPrimary && !isIntercom && "gap-5")}>
        {widgets.map((spec) => (
          <div key={spec.id} id={`post-dc-widget-${spec.id}`} className="scroll-mt-28 min-w-0">
            <DashboardWidget
              title={spec.title}
              isEditing={false}
              columnZone={zone}
              onHide={() => onHide(spec.id)}
            >
              {spec.render(widgetProps)}
            </DashboardWidget>
          </div>
        ))}
      </div>
    </section>
  );
}
