"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import type { LayoutItem } from "react-grid-layout";
import { DashboardWidget } from "@/components/dashboard-grid/dashboard-widget";
import type { WidgetColumn, WidgetSpec } from "@/lib/dashboard/widget-registry";
import {
  useDashboardLayoutStore,
  type LayoutKey,
  type ColumnOrder,
} from "@/stores/use-dashboard-layout";

const ResponsiveGridLayout = WidthProvider(Responsive);

const ROW_HEIGHT = 48;
// Single breakpoint — editing is desktop-only so one layout is enough.
const GRID_BREAKPOINTS = { lg: 0 };
const GRID_COLS = { lg: 12 };

// Pixel-accurate column boundaries match the static CSS grid
// grid-cols-[0.22fr_1fr_0.28fr] ≈ 3 / 6 / 3 columns out of 12
const COL_DEF: Record<WidgetColumn, { x: number; w: number; defaultH: number }> = {
  left:   { x: 0, w: 3, defaultH: 7 },
  center: { x: 3, w: 6, defaultH: 8 },
  right:  { x: 9, w: 3, defaultH: 7 },
};

function pxToRows(px: number): number {
  return Math.max(3, Math.round(px / ROW_HEIGHT));
}

function xToColumn(x: number, w: number): WidgetColumn {
  const mid = x + w / 2;
  if (mid < 3) return "left";
  if (mid < 9) return "center";
  return "right";
}

function columnOrderToLayout(
  columnOrder: ColumnOrder,
  widgetHeights: Record<string, number>
): LayoutItem[] {
  const items: LayoutItem[] = [];
  for (const col of ["left", "center", "right"] as const) {
    const { x, w, defaultH } = COL_DEF[col];
    let y = 0;
    for (const id of columnOrder[col]) {
      const h = widgetHeights[id] ? pxToRows(widgetHeights[id]) : defaultH;
      items.push({ i: id, x, y, w, h, minH: 3, minW: 2 });
      y += h;
    }
  }
  return items;
}

function layoutToColumnOrder(layout: readonly LayoutItem[]): ColumnOrder {
  const grouped: Record<WidgetColumn, LayoutItem[]> = { left: [], center: [], right: [] };
  for (const item of layout) {
    grouped[xToColumn(item.x, item.w)].push(item);
  }
  const order: ColumnOrder = { left: [], center: [], right: [] };
  for (const col of ["left", "center", "right"] as const) {
    order[col] = grouped[col].sort((a, b) => a.y - b.y).map((i) => i.i);
  }
  return order;
}

interface EditableColumnGridProps<P> {
  layoutKey: LayoutKey;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
  columnOrder: ColumnOrder;
}

export function EditableColumnGrid<P>({
  layoutKey,
  widgets,
  widgetProps,
  columnOrder,
}: EditableColumnGridProps<P>) {
  const widgetHeights = useDashboardLayoutStore((s) => s.widgetHeights[layoutKey] ?? {});
  const hideWidget = useDashboardLayoutStore((s) => s.hideWidget);
  const setColumnOrder = useDashboardLayoutStore((s) => s.setColumnOrder);
  const setWidgetHeight = useDashboardLayoutStore((s) => s.setWidgetHeight);

  const widgetById = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const visibleIds = useMemo(() => new Set(widgets.map((w) => w.id)), [widgets]);

  // Build layout once on first render, then keep local control during the session.
  const initRef = useRef<LayoutItem[] | null>(null);
  if (initRef.current === null) {
    initRef.current = columnOrderToLayout(columnOrder, widgetHeights);
  }

  const [localLayout, setLocalLayout] = useState<LayoutItem[]>(initRef.current);

  // When a widget is hidden, remove it from the local layout.
  useEffect(() => {
    setLocalLayout((prev) => prev.filter((item) => visibleIds.has(item.i)));
  }, [visibleIds]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const handleDragStop = (layout: readonly LayoutItem[]) => {
    const next = [...layout];
    setLocalLayout(next);
    setColumnOrder(layoutKey, layoutToColumnOrder(next));
  };

  const handleResizeStop = (layout: readonly LayoutItem[]) => {
    const next = [...layout];
    setLocalLayout(next);
    for (const item of next) {
      setWidgetHeight(layoutKey, item.i, item.h * ROW_HEIGHT);
    }
  };

  const handleLayoutChange = (layout: readonly LayoutItem[]) => {
    setLocalLayout([...layout]);
  };

  return (
    <div className="editing-layout">
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: localLayout }}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={ROW_HEIGHT}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        isDraggable
        isResizable
        draggableHandle=".widget-drag-handle"
        compactType="vertical"
        preventCollision={false}
        resizeHandles={["se", "sw", "s", "ne", "nw", "n", "e", "w"]}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        onLayoutChange={handleLayoutChange}
        useCSSTransforms
      >
        {localLayout.map(({ i }) => {
          const spec = widgetById.get(i);
          if (!spec) return null;
          const zone = xToColumn(
            localLayout.find((l) => l.i === i)?.x ?? COL_DEF[spec.column].x,
            localLayout.find((l) => l.i === i)?.w ?? COL_DEF[spec.column].w
          );
          return (
            <div key={i} className="h-full overflow-hidden">
              <DashboardWidget
                title={spec.title}
                isEditing
                gridMode
                columnZone={zone}
                onHide={() => hideWidget(layoutKey, i)}
              >
                {spec.render(widgetProps)}
              </DashboardWidget>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
