"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Size of a widget's content area, plus convenience thresholds so card
 * bodies can adapt layout without re-measuring themselves.
 *
 * Thresholds (in px, based on the widget body width):
 *   compact: < 360  → collapse to single column, hide non-essential metadata
 *   wide:    > 700  → switch internal layouts to two columns where it helps
 */
export interface WidgetSize {
  width: number;
  height: number;
  compact: boolean;
  wide: boolean;
}

const COMPACT_BREAKPOINT = 360;
const WIDE_BREAKPOINT = 700;

const DEFAULT_SIZE: WidgetSize = {
  width: 480,
  height: 280,
  compact: false,
  wide: false,
};

const WidgetSizeContext = createContext<WidgetSize>(DEFAULT_SIZE);

export function useWidgetSize(): WidgetSize {
  return useContext(WidgetSizeContext);
}

interface DashboardWidgetProps {
  title: string;
  isEditing: boolean;
  onHide?: () => void;
  children: React.ReactNode;
}

export function DashboardWidget({ title, isEditing, onHide, children }: DashboardWidgetProps) {
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
    if (width <= 0) return DEFAULT_SIZE;
    return {
      width,
      height,
      compact: width < COMPACT_BREAKPOINT,
      wide: width > WIDE_BREAKPOINT,
    };
  }, [width, height]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl",
        isEditing && "ring-1 ring-primary/30 bg-card shadow-sm"
      )}
    >
      {isEditing && <WidgetToolbar title={title} onHide={onHide} />}
      <div
        ref={bodyRef}
        className={cn("min-h-0 min-w-0 flex-1 overflow-auto", isEditing ? "p-2" : "")}
      >
        <WidgetSizeContext.Provider value={sizeValue}>{children}</WidgetSizeContext.Provider>
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
