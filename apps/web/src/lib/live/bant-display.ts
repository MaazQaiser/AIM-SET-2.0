import { formatBudgetUsd } from "@/lib/currency-format";
import type { BantSignal, DiscoveryChecklistState } from "@dc-copilot/types";

const FALLBACK_LABELS: Record<string, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
  next_step: "Next step",
};

export const LIVE_BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;
export type LiveBantKey = (typeof LIVE_BANT_KEYS)[number];

export const liveBantLabels: Record<LiveBantKey, string> = {
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
};

export interface ChecklistDisplayGaps {
  missing: string[];
  partial: string[];
}

export interface BantDisplayEvidence {
  value?: string | null;
  snippet?: string | null;
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
      item.tier === "bant" ||
      (Array.isArray(checklist.openGaps) && checklist.openGaps.includes(item.id));
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

export function formatChecklistDisplayGaps(checklist: DiscoveryChecklistState | null): string {
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

export function formatBantEvidenceValue(dimension: LiveBantKey, value: string): string {
  return dimension === "budget" ? formatBudgetUsd(value) : value.trim();
}

function stripBantLabelPrefix(dimension: LiveBantKey, label: string): string {
  const dimensionLabel = liveBantLabels[dimension];
  return label.replace(new RegExp(`^${dimensionLabel}(?:\\s+signal)?:\\s*`, "i"), "").trim();
}

function isGenericBantLabel(dimension: LiveBantKey, label: string): boolean {
  const normalized = label.trim().toLowerCase();
  const dimensionLabel = liveBantLabels[dimension].toLowerCase();
  return normalized === dimensionLabel || normalized === `${dimensionLabel} signal`;
}

function signalDisplayValue(signal: BantSignal): string | null {
  const value = signal.value?.trim();
  if (value) return formatBantEvidenceValue(signal.dimension, value);

  const snippet = signal.snippet?.trim();
  if (snippet) return formatBantEvidenceValue(signal.dimension, snippet);

  const label = signal.label?.trim();
  if (!label || isGenericBantLabel(signal.dimension, label)) return null;

  const strippedLabel = stripBantLabelPrefix(signal.dimension, label);
  if (!strippedLabel || isGenericBantLabel(signal.dimension, strippedLabel)) return null;

  return formatBantEvidenceValue(signal.dimension, strippedLabel);
}

export function confirmedBantDisplayValue({
  dimension,
  status,
  evidence,
  signals = [],
}: {
  dimension: LiveBantKey;
  status: string;
  evidence?: BantDisplayEvidence;
  signals?: BantSignal[];
}): string | null {
  if (status !== "confirmed") return null;

  const evidenceValue = evidence?.value?.trim();
  if (evidenceValue) return formatBantEvidenceValue(dimension, evidenceValue);

  for (const signal of signals) {
    const value = signalDisplayValue(signal);
    if (value) return value;
  }

  const snippet = evidence?.snippet?.trim();
  if (snippet) return formatBantEvidenceValue(dimension, snippet);

  return null;
}
