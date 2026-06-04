import type { KeywordCount, KeywordStats } from "@/types";

/** Prepositions, fillers, and everyday chat — not useful on a live DC screen. */
const LIVE_KEYWORD_STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",
  "we",
  "you",
  "they",
  "it",
  "this",
  "that",
  "these",
  "those",
  "i",
  "he",
  "she",
  "so",
  "if",
  "as",
  "with",
  "from",
  "by",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "up",
  "down",
  "out",
  "off",
  "over",
  "under",
  "again",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "just",
  "also",
  "now",
  "our",
  "your",
  "their",
  "what",
  "which",
  "who",
  "whom",
  "yeah",
  "yes",
  "ok",
  "okay",
  "um",
  "uh",
  "like",
  "know",
  "think",
  "going",
  "get",
  "got",
  "really",
  "well",
  "right",
  "actually",
  "basically",
  "literally",
  "honestly",
  "anyway",
  "anyways",
  "stuff",
  "things",
  "thing",
  "kind",
  "sort",
  "mean",
  "guess",
  "maybe",
  "probably",
  "definitely",
  "absolutely",
  "totally",
  "sure",
  "thanks",
  "thank",
  "please",
  "sorry",
  "hello",
  "hey",
  "hi",
  "bye",
  "see",
  "look",
  "tell",
  "said",
  "say",
  "says",
  "talk",
  "talking",
  "ask",
  "asked",
  "asking",
  "want",
  "wanted",
  "need",
  "needed",
  "make",
  "made",
  "let",
  "put",
  "take",
  "took",
  "come",
  "came",
  "go",
  "went",
  "gonna",
  "wanna",
  "gotta",
  "lot",
  "lots",
  "bit",
  "little",
  "big",
  "today",
  "tomorrow",
  "yesterday",
  "week",
  "month",
  "year",
  "time",
  "times",
  "day",
  "days",
  "people",
  "person",
  "team",
  "teams",
  "company",
  "companies",
  "business",
  "work",
  "working",
  "help",
  "helps",
  "helped",
]);

/** Short generic tokens that rarely indicate industry/tech intent. */
const WEAK_TERMS = new Set([
  "data",
  "system",
  "systems",
  "process",
  "processes",
  "solution",
  "solutions",
  "service",
  "services",
  "project",
  "projects",
  "issue",
  "issues",
  "problem",
  "problems",
  "plan",
  "plans",
  "call",
  "meeting",
  "update",
  "updates",
]);

function normalizeTerm(term: string): string {
  return term.toLowerCase().trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

export function isUsefulLiveKeyword(term: string): boolean {
  const t = normalizeTerm(term);
  if (t.length < 3) return false;
  if (LIVE_KEYWORD_STOPWORDS.has(t)) return false;
  if (WEAK_TERMS.has(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

export function filterKeywordCounts(items: KeywordCount[]): KeywordCount[] {
  return items.filter((k) => isUsefulLiveKeyword(k.term));
}

export function filterKeywordTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  return terms.filter((term) => {
    const t = normalizeTerm(term);
    if (!isUsefulLiveKeyword(t) || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}

export interface LiveKeywordEntry {
  term: string;
  count: number;
}

/** Top keywords with occurrence counts for the live copilot panel. */
export function buildLiveKeywordEntries(
  keywordStats: KeywordStats | null,
  extraTerms: string[],
  transcript: { text?: string; keywords?: string[] }[] = []
): LiveKeywordEntry[] {
  const counts = new Map<string, LiveKeywordEntry>();

  for (const k of filterKeywordCounts(keywordStats?.global_top ?? [])) {
    const key = normalizeTerm(k.term);
    counts.set(key, { term: k.term, count: Math.max(1, k.count) });
  }

  for (const event of transcript) {
    for (const raw of event.keywords ?? []) {
      const key = normalizeTerm(raw);
      if (!isUsefulLiveKeyword(key)) continue;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { term: raw.trim(), count: 1 });
      }
    }
  }

  for (const raw of extraTerms) {
    const key = normalizeTerm(raw);
    if (!isUsefulLiveKeyword(key)) continue;
    if (counts.has(key)) continue;
    const fromText = countTermInTranscript(key, transcript);
    counts.set(key, { term: raw.trim(), count: fromText });
  }

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, 8);
}

function countTermInTranscript(
  normalizedTerm: string,
  transcript: { text?: string }[]
): number {
  if (!normalizedTerm) return 1;
  let total = 0;
  const pattern = new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "gi");
  for (const event of transcript) {
    const text = event.text ?? "";
    const matches = text.match(pattern);
    if (matches) total += matches.length;
  }
  return total > 0 ? total : 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterKeywordStats(stats: KeywordStats | null): KeywordStats | null {
  if (!stats) return null;
  const global_top = filterKeywordCounts(stats.global_top);
  const by_speaker: KeywordStats["by_speaker"] = {};
  for (const [speakerId, terms] of Object.entries(stats.by_speaker ?? {})) {
    const filtered = filterKeywordCounts(terms);
    if (filtered.length > 0) by_speaker[speakerId] = filtered;
  }
  if (global_top.length === 0 && Object.keys(by_speaker).length === 0) return null;
  return { global_top, by_speaker };
}
