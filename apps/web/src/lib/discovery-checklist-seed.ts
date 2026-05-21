import type { BANTScore, Call } from "@/types";
import type { ChecklistItem, DiscoveryChecklistState } from "@dc-copilot/types";

const BANT_KEYS = ["budget", "authority", "need", "timeline"] as const;

const BANT_ITEMS: { id: ChecklistItem["id"]; label: string }[] = [
  { id: "budget", label: "Budget" },
  { id: "authority", label: "Authority" },
  { id: "need", label: "Need" },
  { id: "timeline", label: "Timeline" },
];

const SECONDARY_ITEMS: { id: ChecklistItem["id"]; label: string }[] = [
  { id: "success_criteria", label: "Success criteria" },
  { id: "stakeholders", label: "Stakeholders" },
  { id: "decision_process", label: "Decision process" },
  { id: "current_state", label: "Current state" },
  { id: "competition", label: "Competition" },
  { id: "next_step", label: "Next step" },
  { id: "compliance_security", label: "Compliance & security" },
  { id: "engagement_fit", label: "Engagement fit" },
];

function bantToItemStatus(status: "confirmed" | "partial" | "unknown"): ChecklistItem["status"] {
  if (status === "confirmed") return "confirmed";
  if (status === "partial") return "partial";
  return "pending";
}

function scoreCoverage(items: ChecklistItem[]): { coverage: number; bantCoverage: number } {
  const score = (s: ChecklistItem["status"]) => (s === "confirmed" ? 1 : s === "partial" ? 0.5 : 0);
  const bant = items.filter((i) => i.tier === "bant");
  const all = items;
  const bantCoverage = bant.length ? bant.reduce((a, i) => a + score(i.status), 0) / bant.length : 0;
  const coverage = all.length ? all.reduce((a, i) => a + score(i.status), 0) / all.length : 0;
  return { coverage, bantCoverage };
}

/** Client-side preview before live WS updates arrive. */
export function seedChecklistFromCall(call: Call | undefined): DiscoveryChecklistState | null {
  if (!call) return null;
  const bant = call.bant ?? {
    budget: "unknown",
    authority: "unknown",
    need: "unknown",
    timeline: "unknown",
  };

  const items: ChecklistItem[] = [
    ...BANT_ITEMS.map((row) => ({
      id: row.id,
      label: row.label,
      tier: "bant" as const,
      status: bantToItemStatus(
        bant[row.id as (typeof BANT_KEYS)[number]] as BANTScore[keyof BANTScore]
      ),
      evidence: [],
    })),
    ...SECONDARY_ITEMS.map((row) => ({
      id: row.id,
      label: row.label,
      tier: "secondary" as const,
      status: "pending" as const,
      evidence: [],
    })),
  ];

  const { coverage, bantCoverage } = scoreCoverage(items);
  const openGaps = items
    .filter((i) => (i.tier === "bant" && i.status !== "confirmed") || (i.id === "next_step" && i.status === "pending"))
    .map((i) => i.id);

  return {
    callId: call.id,
    coverage,
    bantCoverage,
    bant,
    items,
    elapsedSeconds: 0,
    openGaps,
    updatedAt: new Date().toISOString(),
  };
}
