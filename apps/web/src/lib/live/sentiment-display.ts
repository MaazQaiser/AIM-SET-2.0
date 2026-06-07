import type { CustomerSentimentCue, SalesRepToneCue, SentimentShift } from "@/types";

export type SentimentTone = "positive" | "neutral" | "negative";
export type SentimentScore = number | null | undefined;

export function hasSentimentScore(score: SentimentScore): score is number {
  return typeof score === "number" && Number.isFinite(score);
}

export function scoreToTone(score: SentimentScore): SentimentTone | null {
  if (!hasSentimentScore(score)) return null;
  if (score > 0.2) return "positive";
  if (score < -0.2) return "negative";
  return "neutral";
}

export function toneEmoji(tone: SentimentTone | null): string {
  switch (tone) {
    case "positive":
      return "😊";
    case "negative":
      return "😟";
    default:
      return "";
  }
}

export function scoreEmoji(score: SentimentScore): string {
  return toneEmoji(scoreToTone(score));
}

export function shiftEmoji(direction: SentimentShift["direction"]): string {
  return direction === "positive" ? "📈" : "📉";
}

export function shiftDirectionEmoji(direction: SentimentShift["direction"]): string {
  return direction === "positive" ? "↗️" : "↘️";
}

export function formatSentimentScore(score: SentimentScore): string {
  if (!hasSentimentScore(score)) return "No signal";
  const pct = Math.round(Math.abs(score) * 100);
  const tone = scoreToTone(score) ?? "neutral";
  if (tone === "neutral") return "Neutral";
  return tone === "positive" ? `+${pct}% upbeat` : `-${pct}% concern`;
}

export function fallbackSalesRepToneCue(score: SentimentScore): SalesRepToneCue {
  if (!hasSentimentScore(score)) {
    return {
      label: "Waiting for signal",
      guidance: "Sales rep tone will appear once the call transcript starts.",
      tone: "neutral",
      source: "fallback",
    };
  }
  const tone = scoreToTone(score) ?? "neutral";
  if (tone === "positive") {
    return {
      label: "Confident support",
      guidance: "Keep the energy buyer-centered and confirm the next step.",
      tone,
      source: "fallback",
    };
  }
  if (tone === "negative") {
    return {
      label: "Needs reset",
      guidance: "Slow down, acknowledge the buyer, and make the next response concise.",
      tone,
      source: "fallback",
    };
  }
  return {
    label: "Steady delivery",
    guidance: "Maintain a calm pace and ask one focused follow-up.",
    tone,
    source: "fallback",
  };
}

export function resolveSalesRepToneCue(
  score: SentimentScore,
  cue?: SalesRepToneCue | null
): SalesRepToneCue {
  if (cue?.label?.trim()) {
    return {
      label: cue.label.trim(),
      guidance:
        cue.guidance?.trim() || fallbackSalesRepToneCue(score).guidance,
      tone: cue.tone ?? scoreToTone(score) ?? "neutral",
      source: cue.source,
    };
  }
  return fallbackSalesRepToneCue(score);
}

export function fallbackCustomerSentimentCue(score: SentimentScore): CustomerSentimentCue {
  if (!hasSentimentScore(score)) {
    return {
      label: "Waiting for signal",
      guidance: "Customer sentiment will appear once the call transcript starts.",
      tone: "neutral",
      source: "fallback",
    };
  }
  const tone = scoreToTone(score) ?? "neutral";
  if (tone === "positive") {
    return {
      label: "Buying confidence",
      guidance: "Confirm what is working, then lock decision criteria and next step.",
      tone,
      source: "fallback",
    };
  }
  if (tone === "negative") {
    return {
      label: "Decision risk",
      guidance: "Acknowledge the concern, ask what is at risk, then address that issue.",
      tone,
      source: "fallback",
    };
  }
  return {
    label: "Evaluating fit",
    guidance: "Ask one focused question to reveal priority, risk, or decision owner.",
    tone,
    source: "fallback",
  };
}

export function resolveCustomerSentimentCue(
  score: SentimentScore,
  cue?: CustomerSentimentCue | null
): CustomerSentimentCue {
  if (cue?.label?.trim()) {
    return {
      label: cue.label.trim(),
      guidance:
        cue.guidance?.trim() || fallbackCustomerSentimentCue(score).guidance,
      tone: cue.tone ?? scoreToTone(score) ?? "neutral",
      source: cue.source,
    };
  }
  return fallbackCustomerSentimentCue(score);
}
