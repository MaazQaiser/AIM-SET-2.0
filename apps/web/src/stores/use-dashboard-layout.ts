"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LayoutItem, ResponsiveLayouts } from "react-grid-layout";

export type LayoutKey = "brief" | "post-dc";

const BREAKPOINTS = ["lg", "md", "sm", "xs"] as const;

const EMPTY_LAYOUTS: ResponsiveLayouts = { lg: [], md: [], sm: [], xs: [] };
const EMPTY_HIDDEN: Record<LayoutKey, string[]> = { brief: [], "post-dc": [] };

let layoutDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export interface WidgetLayoutSeed {
  id: string;
  defaultLayout: Pick<LayoutItem, "x" | "y" | "w" | "h" | "minW" | "minH">;
}

interface DashboardLayoutState {
  isEditing: boolean;
  layouts: Record<LayoutKey, ResponsiveLayouts>;
  hidden: Record<LayoutKey, string[]>;
  setEditing: (value: boolean) => void;
  setLayout: (key: LayoutKey, layouts: ResponsiveLayouts) => void;
  hideWidget: (key: LayoutKey, id: string) => void;
  showWidget: (key: LayoutKey, id: string) => void;
  resetLayout: (key: LayoutKey, defaultLayouts: ResponsiveLayouts) => void;
}

export const useDashboardLayoutStore = create<DashboardLayoutState>()(
  persist(
    (set, get) => ({
      isEditing: false,
      layouts: {
        brief: { ...EMPTY_LAYOUTS },
        "post-dc": { ...EMPTY_LAYOUTS },
      },
      hidden: { ...EMPTY_HIDDEN },

      setEditing: (value) => set({ isEditing: value }),

      setLayout: (key, layouts) => {
        if (layoutDebounceTimer) clearTimeout(layoutDebounceTimer);
        layoutDebounceTimer = setTimeout(() => {
          set((state) => ({
            layouts: {
              ...state.layouts,
              [key]: layouts,
            },
          }));
        }, 200);
      },

      hideWidget: (key, id) => {
        const hidden = get().hidden[key];
        if (hidden.includes(id)) return;
        set((state) => ({
          hidden: {
            ...state.hidden,
            [key]: [...state.hidden[key], id],
          },
        }));
      },

      showWidget: (key, id) => {
        set((state) => ({
          hidden: {
            ...state.hidden,
            [key]: state.hidden[key].filter((w) => w !== id),
          },
        }));
      },

      resetLayout: (key, defaultLayouts) => {
        set((state) => ({
          layouts: {
            ...state.layouts,
            [key]: defaultLayouts,
          },
          hidden: {
            ...state.hidden,
            [key]: [],
          },
        }));
      },
    }),
    {
      name: "dc-copilot:dashboard-layout-v7",
      version: 1,
      migrate: () => ({
        isEditing: false,
        layouts: {
          brief: { ...EMPTY_LAYOUTS },
          "post-dc": { ...EMPTY_LAYOUTS },
        },
        hidden: { ...EMPTY_HIDDEN },
      }),
      partialize: (state) => ({
        layouts: state.layouts,
        hidden: state.hidden,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<DashboardLayoutState> | undefined;
        return {
          ...current,
          ...(p ?? {}),
          layouts: {
            brief: p?.layouts?.brief ?? { ...EMPTY_LAYOUTS },
            "post-dc": p?.layouts?.["post-dc"] ?? { ...EMPTY_LAYOUTS },
          },
          hidden: {
            brief: p?.hidden?.brief ?? [],
            "post-dc": p?.hidden?.["post-dc"] ?? [],
          },
        };
      },
    }
  )
);

export function buildDefaultLayouts(items: WidgetLayoutSeed[], hidden: string[]): ResponsiveLayouts {
  const visible = items.filter((w) => !hidden.includes(w.id));
  const lg: LayoutItem[] = visible.map((w) => ({
    i: w.id,
    x: w.defaultLayout.x,
    y: w.defaultLayout.y,
    w: w.defaultLayout.w,
    h: w.defaultLayout.h,
    minW: w.defaultLayout.minW ?? 3,
    minH: w.defaultLayout.minH ?? 2,
    maxW: 12,
  }));

  /**
   * Scale the 12-col reference layout to a different column count without
   * leaving fractional gaps. Items on the same `y` row are scaled together
   * and any leftover columns are pushed onto the widest item — that way a
   * 4+4+4 triple at lg → 3+3+4 at md (10 cols) instead of 3+3+3 with a hole.
   */
  const scaleToCols = (cols: number): LayoutItem[] => {
    const byRow = new Map<number, LayoutItem[]>();
    for (const item of lg) {
      const bucket = byRow.get(item.y) ?? [];
      bucket.push(item);
      byRow.set(item.y, bucket);
    }

    const result: LayoutItem[] = [];
    for (const row of byRow.values()) {
      const sorted = [...row].sort((a, b) => a.x - b.x);
      const totalLg = sorted.reduce((sum, it) => sum + it.w, 0);
      const fills = totalLg === 12;

      const scaled = sorted.map((it) => ({
        it,
        w: Math.max(1, Math.round((it.w / 12) * cols)),
      }));

      if (fills) {
        // Adjust to land exactly on `cols`.
        let diff = cols - scaled.reduce((sum, s) => sum + s.w, 0);
        // Sort by descending lg width so the biggest item soaks up extras first.
        const adjustOrder = [...scaled].sort((a, b) => b.it.w - a.it.w);
        let idx = 0;
        while (diff !== 0 && adjustOrder.length > 0) {
          const target = adjustOrder[idx % adjustOrder.length];
          if (diff > 0) {
            target.w += 1;
            diff -= 1;
          } else if (target.w > 1) {
            target.w -= 1;
            diff += 1;
          }
          idx += 1;
        }
      }

      let cursor = 0;
      for (const { it, w } of scaled) {
        result.push({
          ...it,
          x: fills ? cursor : Math.min(Math.round((it.x / 12) * cols), Math.max(0, cols - w)),
          w,
          minW: Math.min(it.minW ?? 1, w),
          maxW: cols,
        });
        cursor += w;
      }
    }
    return result;
  };

  return {
    lg,
    md: scaleToCols(10),
    sm: scaleToCols(8),
    xs: lg.map((item, index) => ({
      i: item.i,
      x: 0,
      y: index * (item.h ?? 1),
      w: 4,
      h: item.h,
      minW: Math.min(item.minW ?? 1, 4),
      minH: item.minH,
    })),
  };
}

export function mergeLayouts(
  stored: ResponsiveLayouts | undefined,
  defaults: ResponsiveLayouts,
  visibleIds: Set<string>
): ResponsiveLayouts {
  const result: ResponsiveLayouts = {};
  for (const bp of BREAKPOINTS) {
    const defaultBp = [...(defaults[bp] ?? defaults.lg ?? [])];
    const storedBp = [...(stored?.[bp] ?? [])];
    const storedById = new Map(storedBp.map((item) => [item.i, item]));
    result[bp] = defaultBp
      .filter((item) => visibleIds.has(item.i))
      .map((item) => {
        const saved = storedById.get(item.i);
        return saved ? { ...item, ...saved, i: item.i } : item;
      });
  }
  return result;
}

export const GRID_BREAKPOINTS = { lg: 900, md: 720, sm: 540, xs: 0 };
export const GRID_COLS = { lg: 12, md: 10, sm: 8, xs: 4 };
