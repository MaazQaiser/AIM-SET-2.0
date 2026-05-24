"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { cn } from "@/lib/cn";

/**
 * Size of a widget's content area, plus convenience thresholds so card
 * bodies can adapt layout without re-measuring themselves.
 *
 * Thresholds (in px, based on the widget body width):
 *   compact: < 360  → collapse to single column, hide non-essential metadata
 *   wide:    > 700  → switch internal layouts to two columns where it helps
 */
export type ColumnZone = "left" | "center" | "right";

export interface WidgetSize {
  width: number;
  height: number;
  compact: boolean;
  wide: boolean;
  /** Fixed 3-column call detail layout — center never uses compact clamps. */
  columnZone: ColumnZone;
}

const COMPACT_BREAKPOINT = 360;
const WIDE_BREAKPOINT = 700;

const DEFAULT_SIZE: WidgetSize = {
  width: 480,
  height: 280,
  compact: false,
  wide: false,
  columnZone: "center",
};

const WidgetSizeContext = createContext<WidgetSize>(DEFAULT_SIZE);
const ColumnZoneContext = createContext<ColumnZone>("center");

export function useColumnZone(): ColumnZone {
  return useContext(ColumnZoneContext);
}

export function useWidgetSize(): WidgetSize {
  return useContext(WidgetSizeContext);
}

interface DashboardWidgetProps {
  title: string;
  isEditing: boolean;
  onHide?: () => void;
  /** When true the widget fills its RGL cell — removes max-height caps */
  gridMode?: boolean;
  columnZone?: ColumnZone;
  children: React.ReactNode;
}

export function DashboardWidget({
  title,
  isEditing,
  onHide,
  gridMode = false,
  columnZone = "center",
  children,
}: DashboardWidgetProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [{ width, height }, setSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = { width: entry.contentRect.width, height: entry.contentRect.height };
      setSize((prev) =>
        Math.abs(prev.width - next.width) < 1 && Math.abs(prev.height - next.height) < 1
          ? prev
          : next
      );
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const sizeValue = useMemo<WidgetSize>(() => {
    if (width <= 0) {
      return { ...DEFAULT_SIZE, columnZone };
    }
    const measuredCompact = width < COMPACT_BREAKPOINT;
    const measuredWide = width > WIDE_BREAKPOINT;
    return {
      width,
      height,
      columnZone,
      compact:
        columnZone === "center" ? false : columnZone === "left" || columnZone === "right" ? true : measuredCompact,
      wide: columnZone === "center" ? measuredWide : false,
    };
  }, [width, height, columnZone]);

  const context = (
    <ColumnZoneContext.Provider value={columnZone}>
      <WidgetSizeContext.Provider value={sizeValue}>{children}</WidgetSizeContext.Provider>
    </ColumnZoneContext.Provider>
  );

  if (!isEditing) {
    return (
      <div ref={bodyRef} className="min-w-0 w-full">
        {context}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-xl ring-1 ring-primary/30 bg-card shadow-sm",
        gridMode ? "h-full" : columnZone === "center" ? "min-h-0" : "max-h-[min(28rem,55vh)] shrink-0"
      )}
    >
      <WidgetToolbar title={title} onHide={onHide} />
      <div
        ref={bodyRef}
        className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-2"
      >
        {context}
      </div>
    </div>
  );
}

function WidgetToolbar({ title, onHide }: { title: string; onHide?: () => void }) {
  return (
    <div className="widget-drag-handle flex shrink-0 cursor-grab items-center gap-2 border-b bg-muted/40 px-3 py-2 active:cursor-grabbing">
      <GripVertical className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 truncate text-xs font-medium text-foreground">{title}</span>
      {onHide && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          aria-label={`Hide ${title}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
