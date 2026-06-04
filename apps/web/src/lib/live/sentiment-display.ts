import type { CustomerSentimentCue, SalesRepToneCue, SentimentShift } from "@/types";

export type SentimentTone = "positive" | "neutral" | "negative";

export function scoreToTone(score: number): SentimentTone {
  if (score > 0.2) return "positive";
  if (score < -0.2) return "negative";
  return "neutral";
}

export function toneEmoji(tone: SentimentTone): string {
  switch (tone) {
    case "positive":
      return "😊";
    case "negative":
      return "😟";
    default:
      return "😐";
  }
}

export function scoreEmoji(score: number): string {
  return toneEmoji(scoreToTone(score));
}

export function shiftEmoji(direction: SentimentShift["direction"]): string {
  return direction === "positive" ? "📈" : "📉";
}

export function shiftDirectionEmoji(direction: SentimentShift["direction"]): string {
  return direction === "positive" ? "↗️" : "↘️";
}

export function formatSentimentScore(score: number): string {
  const pct = Math.round(Math.abs(score) * 100);
  const tone = scoreToTone(score);
  if (tone === "neutral") return "Neutral";
  return tone === "positive" ? `+${pct}% upbeat` : `-${pct}% concern`;
}

export function fallbackSalesRepToneCue(score: number): SalesRepToneCue {
  const tone = scoreToTone(score);
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
  score: number,
  cue?: SalesRepToneCue | null
): SalesRepToneCue {
  if (cue?.label?.trim()) {
    return {
      label: cue.label.trim(),
      guidance:
        cue.guidance?.trim() || fallbackSalesRepToneCue(score).guidance,
      tone: cue.tone ?? scoreToTone(score),
      source: cue.source,
    };
  }
  return fallbackSalesRepToneCue(score);
}

export function fallbackCustomerSentimentCue(score: number): CustomerSentimentCue {
  const tone = scoreToTone(score);
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
  score: number,
  cue?: CustomerSentimentCue | null
): CustomerSentimentCue {
  if (cue?.label?.trim()) {
    return {
      label: cue.label.trim(),
      guidance:
        cue.guidance?.trim() || fallbackCustomerSentimentCue(score).guidance,
      tone: cue.tone ?? scoreToTone(score),
      source: cue.source,
    };
  }
  return fallbackCustomerSentimentCue(score);
}
