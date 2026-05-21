import type { SentimentShift } from "@/types";

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
