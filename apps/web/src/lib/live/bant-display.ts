import type { DiscoveryChecklistState } from "@dc-copilot/types";

const FALLBACK_LABELS: Record<string, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
  next_step: "Next step",
};

export interface ChecklistDisplayGaps {
  missing: string[];
  partial: string[];
}

function labelFromId(id: string): string {
  return FALLBACK_LABELS[id] ?? id.replace(/_/g, " ");
}

function pushUnique(list: string[], label: string) {
  if (!label || list.includes(label)) return;
  list.push(label);
}

export function checklistDisplayGaps(
  checklist: DiscoveryChecklistState | null
): ChecklistDisplayGaps {
  if (!checklist) return { missing: [], partial: [] };

  const missing: string[] = [];
  const partial: string[] = [];
  const items = Array.isArray(checklist.items) ? checklist.items : [];

  for (const item of items) {
    const isOpenTracked =
      item.tier === "bant" || (Array.isArray(checklist.openGaps) && checklist.openGaps.includes(item.id));
    if (!isOpenTracked) continue;

    if (item.status === "partial" && item.tier === "bant") {
      pushUnique(partial, item.label || labelFromId(item.id));
    } else if (item.status === "pending") {
      pushUnique(missing, item.label || labelFromId(item.id));
    }
  }

  for (const id of checklist.openGaps ?? []) {
    const item = items.find((candidate) => candidate.id === id);
    if (item?.status === "partial" && item.tier === "bant") {
      pushUnique(partial, item.label || labelFromId(id));
    } else if (!item || item.status === "pending") {
      pushUnique(missing, item?.label || labelFromId(id));
    }
  }

  return { missing, partial };
}

export function formatChecklistDisplayGaps(
  checklist: DiscoveryChecklistState | null
): string {
  const gaps = checklistDisplayGaps(checklist);
  const parts: string[] = [];
  if (gaps.missing.length > 0) {
    parts.push(`Open: ${gaps.missing.join(", ")}`);
  }
  if (gaps.partial.length > 0) {
    parts.push(`Partial: ${gaps.partial.join(", ")}`);
  }
  return parts.join(" · ");
}
