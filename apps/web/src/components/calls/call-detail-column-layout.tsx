"use client";

import { useEffect, useMemo, useRef } from "react";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import {
  buildDefaultColumnOrder,
  mergeColumnOrder,
  orderWidgetsByColumn,
} from "@/lib/dashboard/column-order";
import type { WidgetColumn, WidgetSpec } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";
import { useDashboardLayoutStore, type LayoutKey } from "@/stores/use-dashboard-layout";
import { EditableColumnGrid } from "@/components/calls/editable-column-grid";

interface CallDetailColumnLayoutProps<P> {
  layoutKey: LayoutKey;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
  /** Rendered at top of center column (e.g. Join call) */
  centerHeader?: React.ReactNode;
}

const COLUMN_LABELS: Record<WidgetColumn, string> = {
  left: "Account & research",
  center: "Discuss & prep",
  right: "Coverage & completion",
};

export function CallDetailColumnLayout<P>({
  layoutKey,
  widgets,
  widgetProps,
  centerHeader,
}: CallDetailColumnLayoutProps<P>) {
  const isEditing = useDashboardLayoutStore((s) => s.isEditing);
  const hidden = useDashboardLayoutStore((s) => s.hidden[layoutKey] ?? []);
  const storedOrder = useDashboardLayoutStore((s) => s.columnOrder[layoutKey]);
  const widgetHeights = useDashboardLayoutStore((s) => s.widgetHeights[layoutKey] ?? {});
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

  // Static 3-column view.
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
  if (widgets.length === 0 && !header) return null;

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col gap-3",
        zone === "center"
          ? "min-h-0"
          : "lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
      )}
      aria-label={label}
    >
      {header}
      <div className={cn("flex flex-col gap-3 min-w-0", isPrimary && "gap-4")}>
        {widgets.map((spec) => (
          <DashboardWidget
            key={spec.id}
            title={spec.title}
            isEditing={false}
            columnZone={zone}
            onHide={() => onHide(spec.id)}
          >
            {spec.render(widgetProps)}
          </DashboardWidget>
        ))}
      </div>
    </section>
  );
}
