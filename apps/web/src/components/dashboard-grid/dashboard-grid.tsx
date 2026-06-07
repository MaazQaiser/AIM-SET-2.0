"use client";

import { useEffect, useMemo, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { ResponsiveLayouts } from "react-grid-layout";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import type { WidgetSpec } from "@/lib/dashboard/widget-registry";
import { cn } from "@/lib/cn";
import {
  GRID_BREAKPOINTS,
  GRID_COLS,
  buildDefaultLayouts,
  mergeLayouts,
  useDashboardLayoutStore,
  type LayoutKey,
} from "@/stores/use-dashboard-layout";

const ResponsiveGridLayout = WidthProvider(Responsive);
const EMPTY_HIDDEN: string[] = [];

interface DashboardGridProps<P> {
  layoutKey: LayoutKey;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
}

export function DashboardGrid<P>({ layoutKey, widgets, widgetProps }: DashboardGridProps<P>) {
  const isEditing = useDashboardLayoutStore((s) => s.isEditing);
  const hidden = useDashboardLayoutStore((s) => s.hidden[layoutKey] ?? EMPTY_HIDDEN);
  const storedLayouts = useDashboardLayoutStore((s) => s.layouts[layoutKey]);
  const setLayout = useDashboardLayoutStore((s) => s.setLayout);
  const hideWidget = useDashboardLayoutStore((s) => s.hideWidget);

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  const defaultLayouts = useMemo(
    () => buildDefaultLayouts(visibleWidgets, hidden),
    [visibleWidgets, hidden]
  );

  const layouts = useMemo(
    () => mergeLayouts(storedLayouts, defaultLayouts, visibleIds),
    [storedLayouts, defaultLayouts, visibleIds]
  );

  const editingEnabled = isEditing && !isMobile && mounted;

  if (!mounted) {
    return <StaticWidgetStack widgets={visibleWidgets} widgetProps={widgetProps} />;
  }

  return (
    <div className={cn(editingEnabled && "editing-layout")}>
      {isMobile && isEditing && (
        <p className="mb-3 type-caption text-muted-foreground">Customize layout on larger screens.</p>
      )}
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={28}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editingEnabled}
        isResizable={editingEnabled}
        draggableHandle=".widget-drag-handle"
        /* vertical compact + collisions allowed = dragging a widget pushes others out of the way */
        compactType="vertical"
        preventCollision={false}
        resizeHandles={editingEnabled ? ["se", "sw", "ne", "nw", "e", "w", "s", "n"] : ["se"]}
        onLayoutChange={(_layout, allLayouts) => {
          if (editingEnabled) setLayout(layoutKey, allLayouts as ResponsiveLayouts);
        }}
        useCSSTransforms
      >
        {visibleWidgets.map((spec) => (
          <div key={spec.id} className="h-full">
            <DashboardWidget
              title={spec.title}
              isEditing={editingEnabled}
              onHide={() => hideWidget(layoutKey, spec.id)}
            >
              {spec.render(widgetProps)}
            </DashboardWidget>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}

function StaticWidgetStack<P>({
  widgets,
  widgetProps,
}: {
  widgets: WidgetSpec<P>[];
  widgetProps: P;
}) {
  return (
    <div className="space-y-5">
      {widgets.map((spec) => (
        <StaticWidgetItem key={spec.id} spec={spec} widgetProps={widgetProps} />
      ))}
    </div>
  );
}

function StaticWidgetItem<P>({ spec, widgetProps }: { spec: WidgetSpec<P>; widgetProps: P }) {
  return <div>{spec.render(widgetProps)}</div>;
}
