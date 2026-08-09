import type { ModelTier } from "@/types/agents";

/** List prices per 1M tokens (aligned with docs/LLM_COST_AND_MODEL_REPORT.md). */
export interface ModelPriceRow {
  model: string;
  tier: ModelTier;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
}

export const MODEL_OPTIONS: ModelPriceRow[] = [
  {
    model: "gpt-5.4-mini",
    tier: "mini",
    label: "OpenAI GPT-5.4 Mini (default, low cost)",
    inputPer1M: 0.75,
    outputPer1M: 4.5,
  },
  {
    model: "claude-3-haiku-20240307",
    tier: "haiku",
    label: "Claude Haiku 4.5 (fast)",
    inputPer1M: 1.0,
    outputPer1M: 5.0,
  },
  {
    model: "claude-sonnet-4-20250514",
    tier: "sonnet",
    label: "Claude Sonnet 4.6 (balanced)",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    model: "claude-opus-4-1-20250805",
    tier: "opus",
    label: "Claude Opus 4.1 (highest quality)",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
  {
    model: "claude-3-opus-20240229",
    tier: "opus",
    label: "Claude 3 Opus (legacy)",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
];

export function findModelPrice(modelName: string): ModelPriceRow | undefined {
  const exact = MODEL_OPTIONS.find((m) => m.model === modelName);
  if (exact) return exact;
  const lower = modelName.toLowerCase();
  if (lower.includes("gpt-5.4-mini") || (lower.includes("gpt") && lower.includes("mini"))) {
    return MODEL_OPTIONS.find((m) => m.tier === "mini");
  }
  if (lower.includes("haiku")) return MODEL_OPTIONS.find((m) => m.tier === "haiku");
  if (lower.includes("sonnet")) return MODEL_OPTIONS.find((m) => m.tier === "sonnet");
  if (lower.includes("opus")) return MODEL_OPTIONS.find((m) => m.model.includes("opus-4-1"));
  return undefined;
}

/** LLM cost = (input_tokens * input_$/1M + output_tokens * output_$/1M) / 1_000_000 */
export function estimateLlmCostUsd(
  modelName: string,
  inputTokens: number,
  outputTokens: number
): number {
  const row = findModelPrice(modelName);
  const inputPer1M = row?.inputPer1M ?? 0.75;
  const outputPer1M = row?.outputPer1M ?? 4.5;
  return (inputTokens * inputPer1M + outputTokens * outputPer1M) / 1_000_000;
}

export function formatUsd(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.0001 && value > 0) return `$${value.toExponential(2)}`;
  return `$${value.toFixed(digits)}`;
}

/** Typical token budgets used for config-page estimates. */
export const COST_SCENARIOS: Record<
  string,
  { label: string; calls: number; inputPerCall: number; outputPerCall: number; note: string }
> = {
  "live-call": {
    label: "Typical live-call LLM burst",
    calls: 2,
    inputPerCall: 2500,
    outputPerCall: 400,
    note: "Rules run first; LLM only on priority triggers. ~2 calls per qualifying segment.",
  },
  workflow: {
    label: "Full Pre-DC pipeline (3 steps)",
    calls: 3,
    inputPerCall: 4000,
    outputPerCall: 1200,
    note: "Summary + artifact plan + artifact fulfill.",
  },
  post_dc: {
    label: "Post-DC review (3 steps)",
    calls: 3,
    inputPerCall: 5000,
    outputPerCall: 1500,
    note: "Summary + email + coaching.",
  },
  content: {
    label: "Pre-DC brief",
    calls: 1,
    inputPerCall: 3500,
    outputPerCall: 1500,
    note: "Single brief generation call.",
  },
  content_generation: {
    label: "10-slide deck (expected)",
    calls: 1,
    inputPerCall: 14000,
    outputPerCall: 12000,
    note: "From LLM cost report expected deck scenario.",
  },
  "discovery-checklist": {
    label: "Checklist pass (if LLM enabled)",
    calls: 1,
    inputPerCall: 2000,
    outputPerCall: 500,
    note: "Currently rule-based; estimate only if model is used.",
  },
};
