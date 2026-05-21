import type { WidgetColumn } from "@/lib/dashboard/widget-registry";

export type ColumnOrder = Record<WidgetColumn, string[]>;

export const EMPTY_COLUMN_ORDER: ColumnOrder = { left: [], center: [], right: [] };

export interface ColumnOrderSeed {
  id: string;
  column: WidgetColumn;
  sortOrder: number;
}

export function buildDefaultColumnOrder(seeds: ColumnOrderSeed[]): ColumnOrder {
  const order: ColumnOrder = { left: [], center: [], right: [] };
  for (const col of ["left", "center", "right"] as const) {
    order[col] = seeds
      .filter((s) => s.column === col)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => s.id);
  }
  return order;
}

export function mergeColumnOrder(
  stored: ColumnOrder | undefined,
  defaults: ColumnOrder,
  visibleIds: Set<string>
): ColumnOrder {
  const result: ColumnOrder = { left: [], center: [], right: [] };
  for (const col of ["left", "center", "right"] as const) {
    const defaultIds = defaults[col].filter((id) => visibleIds.has(id));
    const storedIds = (stored?.[col] ?? []).filter((id) => visibleIds.has(id));
    const seen = new Set<string>();
    for (const id of storedIds) {
      if (!seen.has(id)) {
        result[col].push(id);
        seen.add(id);
      }
    }
    for (const id of defaultIds) {
      if (!seen.has(id)) {
        result[col].push(id);
        seen.add(id);
      }
    }
  }
  return result;
}

export function orderWidgetsByColumn<P extends ColumnOrderSeed>(
  widgets: P[],
  columnOrder: ColumnOrder
): Record<WidgetColumn, P[]> {
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const grouped: Record<WidgetColumn, P[]> = { left: [], center: [], right: [] };
  for (const col of ["left", "center", "right"] as const) {
    grouped[col] = columnOrder[col]
      .map((id) => byId.get(id))
      .filter((w): w is P => Boolean(w));
  }
  return grouped;
}
