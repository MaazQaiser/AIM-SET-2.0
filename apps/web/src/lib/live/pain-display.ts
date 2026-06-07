import type { PainSignal } from "@/types";

const SUMMARY_MAX = 100;

function normalizePainText(text: string): string {
  return text
    .toLowerCase()
    .replace(/["""'']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function painDedupeKey(text: string): string {
  return normalizePainText(text).slice(0, 80);
}

function isVaguePainLabel(text: string): boolean {
  const normalized = normalizePainText(text);
  return (
    /^that'?s the pain\b/.test(normalized) ||
    /^this is the pain\b/.test(normalized) ||
    /^the pain keeping\b/.test(normalized) ||
    /^pain keeping\b/.test(normalized)
  );
}

export function painsAreSimilar(a: string, b: string): boolean {
  const na = normalizePainText(a);
  const nb = normalizePainText(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  if (na.slice(0, 56) === nb.slice(0, 56)) return true;
  return false;
}

/** Keep the most recent unique pain — match on text similarity, not just id. */
export function dedupePainSignals(pains: PainSignal[]): PainSignal[] {
  const kept: PainSignal[] = [];

  for (let i = pains.length - 1; i >= 0; i -= 1) {
    const pain = pains[i];
    const duplicate = kept.some((existing) => painsAreSimilar(existing.text, pain.text));
    if (duplicate) continue;
    kept.unshift(pain);
  }

  return kept;
}

function summarizePainQuote(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^(honestly|yeah|so|well|look),?\s*/i, "");

  const dashParts = text.split(/\s*[—–-]\s+/);
  if (dashParts.length > 1) {
    const beforeDash = dashParts[0]?.trim() ?? "";
    const afterDash = dashParts.slice(1).join(" — ").trim();
    if (afterDash.length >= 20 && !isVaguePainLabel(afterDash)) {
      text = afterDash;
    } else if (beforeDash.length >= 20) {
      text = beforeDash;
    }
  }

  if (text.length <= SUMMARY_MAX) return text;

  const clipped = text.slice(0, SUMMARY_MAX - 1);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()}…`;
}

/** Concise bullet text — not the raw customer quote when evidence exists. */
export function painSummary(pain: PainSignal): string {
  const text = pain.text.trim();
  const quote = pain.evidence?.trim();

  if (quote && isVaguePainLabel(text)) {
    return summarizePainQuote(quote);
  }

  if (quote && quote !== text && text.length <= SUMMARY_MAX && !quote.startsWith(text.slice(0, 40))) {
    return text;
  }

  const source = quote && quote.length >= text.length ? quote : text;
  if (source.length > SUMMARY_MAX || /^(honestly|yeah|so|well)\b/i.test(source)) {
    return summarizePainQuote(source);
  }

  return text;
}

/** Customer's words — shown only after See more. */
export function painQuote(pain: PainSignal): string | undefined {
  const summary = painSummary(pain);
  const quote = (pain.evidence?.trim() || pain.text.trim()).trim();
  if (!quote) return undefined;
  if (normalizePainText(quote) === normalizePainText(summary)) return undefined;
  return quote;
}

export { painDedupeKey, normalizePainText };
