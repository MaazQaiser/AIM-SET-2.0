"use client";

import { Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WidgetSpec } from "@/lib/dashboard/widget-registry";
import { buildDefaultLayouts, useDashboardLayoutStore, type LayoutKey } from "@/stores/use-dashboard-layout";

interface LayoutControlsProps<P> {
  layoutKey: LayoutKey;
  widgets: WidgetSpec<P>[];
  widgetProps: P;
}

export function LayoutControls<P>({ layoutKey, widgets, widgetProps }: LayoutControlsProps<P>) {
  const isEditing = useDashboardLayoutStore((s) => s.isEditing);
  const hidden = useDashboardLayoutStore((s) => s.hidden[layoutKey] ?? []);
  const showWidget = useDashboardLayoutStore((s) => s.showWidget);
  const resetLayout = useDashboardLayoutStore((s) => s.resetLayout);

  // Header owns the Customize / Done toggle now — render nothing in view mode.
  if (!isEditing) return null;

  const hiddenWidgets = widgets.filter((w) => {
    if (!hidden.includes(w.id)) return false;
    if (w.isAvailable && !w.isAvailable(widgetProps)) return false;
    return true;
  });

  const handleReset = () => {
    const available = widgets.filter((w) => {
      if (w.isAvailable && !w.isAvailable(widgetProps)) return false;
      return true;
    });
    resetLayout(layoutKey, buildDefaultLayouts(available, []));
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <p className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
        Drag into open space beside another widget. Resize to half width (6 cols) for two columns.
      </p>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
      {hiddenWidgets.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add widget
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-2">
            <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Hidden widgets</p>
            <ul className="space-y-1">
              {hiddenWidgets.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    onClick={() => showWidget(layoutKey, w.id)}
                  >
                    {w.title}
                  </button>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
