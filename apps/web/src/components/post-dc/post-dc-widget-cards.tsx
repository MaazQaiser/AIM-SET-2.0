"use client";

import { Brain, FileSearch, Sparkles, Users } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import {
  BriefDetailCard,
  BriefDetailRow,
} from "@/components/pre-call/brief-detail-card";
import type {
  PostCallKbSuggestion,
  PostCallReview,
} from "@/lib/brief-types";

export function PostHeadlineCard({ headline }: { headline: string }) {
  return (
    <BriefDetailCard title="Headline" icon={Sparkles} variant="highlight">
      <p className="text-sm font-medium text-foreground leading-relaxed break-words">{headline}</p>
    </BriefDetailCard>
  );
}

export function PostSummaryCard({ summary }: { summary: string[] }) {
  return (
    <BriefDetailCard title="Summary" icon={Brain}>
      <ul className="divide-y divide-border">
        {summary.map((p) => (
          <li key={p} className="py-2.5 text-sm text-muted-foreground whitespace-pre-wrap break-words first:pt-0 last:pb-0">
            {p}
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function PostScorecardCard({ scorecard }: { scorecard: PostCallReview["podScorecard"] }) {
  if (scorecard.length === 0) return null;

  return (
    <BriefDetailCard title="Pod member coaching" icon={Users}>
      <ul className="grid gap-3 lg:grid-cols-2">
        {scorecard.map((row) => (
          <li key={row.member}>
            <BriefDetailRow>
              <div className="flex items-start justify-between gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{row.member}</p>
                  <p className="mt-0.5 text-[10px] uppercase text-muted-foreground">
                    Role in call: {row.roleInCall || row.role}
                  </p>
                </div>
                <Badge
                  variant={
                    row.score >= 0.8 ? "success" : row.score >= 0.7 ? "warning" : "secondary"
                  }
                  className="shrink-0 capitalize"
                >
                  {row.label || "Review"}
                </Badge>
              </div>
              <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <MetricPill label="Performance" value={formatPerformance(row)} />
                <MetricPill label="Talk time" value={formatTalkTime(row)} />
              </div>
              {row.strengths ? (
                <p className="text-xs text-foreground break-words mt-3">
                  <span className="font-medium">What worked:</span> {row.strengths}
                </p>
              ) : null}
              {areasToWork(row).length > 0 ? (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Areas to work
                  </p>
                  <ul className="space-y-1">
                    {areasToWork(row).map((item) => (
                      <li key={item} className="text-xs text-muted-foreground break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">
                  No coaching area was flagged for this member.
                </p>
              )}
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}

function formatPerformance(row: PostCallReview["podScorecard"][number]) {
  const label = row.label?.trim() || "Review";
  if (typeof row.score !== "number") return label;
  return `${label} · ${Math.round(row.score * 100)}%`;
}

function formatTalkTime(row: PostCallReview["podScorecard"][number]) {
  if (row.talkTimeLabel?.trim()) return row.talkTimeLabel.trim();
  if (typeof row.talkTimeSeconds !== "number" || Number.isNaN(row.talkTimeSeconds)) {
    return "Not captured";
  }
  const minutes = Math.floor(row.talkTimeSeconds / 60);
  const seconds = Math.round(row.talkTimeSeconds % 60);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function areasToWork(row: PostCallReview["podScorecard"][number]) {
  const areas = row.areasToWork?.filter((item) => item.trim()) ?? [];
  if (areas.length > 0) return areas;
  return row.watch?.trim() ? [row.watch.trim()] : [];
}

export function PostLearnedCard({ learned }: { learned: PostCallReview["learned"] }) {
  if (learned.length === 0) return null;

  return (
    <BriefDetailCard title="BANT learnings">
      <ul className="space-y-2">
        {learned.map((item) => (
          <li key={item.label}>
            <BriefDetailRow>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {item.label}
              </p>
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-1">
                {item.note}
              </p>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function PostKbSuggestionsCard({ suggestions }: { suggestions: PostCallKbSuggestion[] }) {
  if (suggestions.length === 0) return null;

  return (
    <BriefDetailCard title="Content suggestions" icon={FileSearch} scrollMaxHeight="14rem">
      <ul className="space-y-2">
        {suggestions.map((item) => (
          <li key={item.assetId}>
            <BriefDetailRow>
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground break-words">
                    {kbSuggestionTitle(item)}
                  </p>
                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground break-all">
                    {item.assetId}
                  </p>
                </div>
                {typeof item.score === "number" && (
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {Math.round(item.score * 100)}%
                  </Badge>
                )}
              </div>
              <div className="mt-2 space-y-1.5 text-xs">
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Why it matched:</span>{" "}
                  {kbSuggestionReason(item)}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground">Suggested use:</span>{" "}
                  {item.suggestedUse ?? "Use as supporting proof in the follow-up or proposal."}
                </p>
                {(item.downloadUrl || item.assetId) && (
                  <a
                    href={item.downloadUrl ?? `/api/kb/assets/${item.assetId}/file`}
                    className="inline-flex text-xs font-medium text-primary hover:underline"
                  >
                    Open asset
                  </a>
                )}
              </div>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

function kbSuggestionTitle(item: PostCallKbSuggestion) {
  if (item.title?.trim()) return item.title.trim();
  return item.assetId
    .replace(/^dc:/, "")
    .replace(/[-_:]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Content asset";
}

function kbSuggestionReason(item: PostCallKbSuggestion) {
  if (item.reason?.trim()) return item.reason.trim();

  const fields = parseKbFields(item.snippet);
  const industry = firstField(fields, "Industry", "LinkedIn Category", "LinkedIn Category / Sector");
  const tech = splitTerms(
    firstField(fields, "Technology"),
    firstField(fields, "Cloud Service"),
    firstField(fields, "Skill"),
    firstField(fields, "Platform"),
    firstField(fields, "Architecture"),
    firstField(fields, "Tool")
  );

  if (industry && tech.length > 0) {
    return `Matches ${industry} with ${tech.join(", ")}.`;
  }
  if (industry) return `Matches ${industry} context for this follow-up.`;
  if (tech.length > 0) return `Matches the technology stack: ${tech.join(", ")}.`;

  const clean = item.snippet.replace(/\s+/g, " ").trim();
  return clean || "Relevant to this follow-up.";
}

function parseKbFields(snippet: string) {
  const fields = new Map<string, string>();
  for (const part of snippet.replace(/\n/g, ";").split(";")) {
    const [rawKey, ...rest] = part.split(":");
    const value = rest.join(":").trim();
    const key = rawKey?.trim();
    if (!key || !value || isEmptyKbValue(value)) continue;
    fields.set(normalizeKbKey(key), value);
  }
  return fields;
}

function firstField(fields: Map<string, string>, ...keys: string[]) {
  for (const key of keys) {
    const value = fields.get(normalizeKbKey(key));
    if (value && !isEmptyKbValue(value)) return value;
  }
  return "";
}

function normalizeKbKey(value: string) {
  return value.toLowerCase().replace(/[/-]/g, " ").replace(/\s+/g, " ").trim();
}

function isEmptyKbValue(value: string) {
  return ["", "n/a", "na", "none", "null", "-"].includes(value.trim().toLowerCase());
}

function splitTerms(...values: string[]) {
  const terms: string[] = [];
  for (const value of values) {
    for (const part of value.split(/,|\||\//)) {
      const term = part.trim();
      if (term && !isEmptyKbValue(term) && !terms.includes(term)) terms.push(term);
    }
  }
  return terms.slice(0, 7);
}
