"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  FilePlus2,
  FileSearch,
  ListChecks,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BriefDetailCard,
  BriefDetailRow,
  briefBodyForegroundClass,
  briefBodyMutedClass,
  briefMainBody,
} from "@/components/pre-call/brief-detail-card";
import { PostDcExpandableCard } from "@/components/post-dc/post-dc-expandable-card";
import { PostDcAiNextSteps } from "@/components/post-dc/post-dc-ai-next-steps";
import { PostDcDeadlineNote } from "@/components/post-dc/post-dc-deadline-note";
import { PostDcModalSection } from "@/components/post-dc/post-dc-modal-section";
import { PlainMarkdownBold } from "@/components/post-dc/plain-markdown-bold";
import type {
  PostCallEmailAttachmentFound,
  PostCallEmailAttachmentMissing,
  PostCallEmailAttachments,
  PostCallKbSuggestion,
  PostCallReview,
} from "@/lib/brief-types";
import { KbAttachmentCard } from "@/components/post-dc/kb-attachment-card";
import { cn } from "@/lib/cn";

export function PostBeforeContextCard({ callId }: { callId: string }) {
  return (
    <BriefDetailCard title="Pre-call context" variant="highlight">
      <p className={briefBodyMutedClass}>
        This is all that happened before the call — research, artifacts, and discovery questions from
        the pre-call brief.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-3 gap-1.5">
        <Link href={`/calls/${callId}`}>
          Open pre-call brief
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </BriefDetailCard>
  );
}

export function PostNextStepProposalCard({ proposal }: { proposal: string }) {
  if (!proposal.trim()) return null;

  return (
    <BriefDetailCard title="Recommended next step" icon={ListChecks} variant="highlight">
      <p className={cn(briefBodyForegroundClass, "font-medium whitespace-pre-wrap break-words")}>
        {proposal}
      </p>
    </BriefDetailCard>
  );
}

export function PostHeadlineCard({ headline }: { headline: string }) {
  return (
    <BriefDetailCard title="Headline" icon={Sparkles} variant="highlight">
      <p className={cn(briefBodyForegroundClass, "font-medium break-words")}>{headline}</p>
    </BriefDetailCard>
  );
}

export function PostSummaryCard({
  summary,
  recommendation,
  review,
  deadlineNote,
}: {
  summary: string[];
  recommendation?: string;
  review?: PostCallReview;
  /** Important deadline / note from deal signals (Additional Info) */
  deadlineNote?: string;
}) {
  const trimmedRecommendation = recommendation?.trim();
  const trimmedDeadline = deadlineNote?.trim();
  const openGaps = review?.openDiscoveryGaps ?? [];
  const headline = review?.headline?.trim();

  const summaryList = (
    <ul className="divide-y divide-border w-full">
      {summary.map((p) => (
        <li
          key={p}
          className={cn(
            briefMainBody,
            "py-2.5 text-foreground/90 whitespace-pre-wrap break-words first:pt-0 last:pb-0 w-full"
          )}
        >
          <PlainMarkdownBold text={p} />
        </li>
      ))}
    </ul>
  );

  return (
    <PostDcExpandableCard
      title="Call summary"
      icon={Brain}
      expandLabel="Expand call summary"
      modalContent={
        <div className="space-y-6">
          {headline ? (
            <PostDcModalSection title="Headline">
              <p className="text-base font-medium text-foreground leading-relaxed break-words">
                {headline}
              </p>
            </PostDcModalSection>
          ) : null}

          <PostDcModalSection title="What happened on the call">
            <ul className="divide-y divide-border/60">
              {summary.map((p) => (
                <li
                  key={p}
                  className={cn(
                    briefMainBody,
                    "py-3 text-foreground/90 whitespace-pre-wrap break-words first:pt-0 last:pb-0"
                  )}
                >
                  <PlainMarkdownBold text={p} />
                </li>
              ))}
            </ul>
          </PostDcModalSection>

          {trimmedDeadline ? (
            <PostDcModalSection
              title="Deadline / key note"
              description="Time-sensitive follow-up from the discovery call."
            >
              <PostDcDeadlineNote text={trimmedDeadline} showLabel={false} className="pt-0 mt-0 border-0" />
            </PostDcModalSection>
          ) : null}

          {trimmedRecommendation ? (
            <PostDcModalSection
              title="AI recommended next steps"
              description="Suggested follow-up based on discovery outcomes, BANT, and deal signals."
            >
              <PostDcAiNextSteps text={trimmedRecommendation} showLabel={false} className="pt-0 mt-0 border-0" />
            </PostDcModalSection>
          ) : null}

          {openGaps.length > 0 ? (
            <PostDcModalSection
              title="Reasoning — open gaps"
              description="Why these next steps matter: unresolved discovery areas from the call."
            >
              <ul className={cn("list-disc pl-5 space-y-2", briefBodyMutedClass)}>
                {openGaps.map((gap) => (
                  <li key={gap} className="leading-relaxed break-words">
                    {gap}
                  </li>
                ))}
              </ul>
            </PostDcModalSection>
          ) : null}
        </div>
      }
    >
      {summaryList}
      {trimmedDeadline ? <PostDcDeadlineNote text={trimmedDeadline} /> : null}
      {trimmedRecommendation ? <PostDcAiNextSteps text={trimmedRecommendation} /> : null}
    </PostDcExpandableCard>
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
                  <p className="type-body font-medium text-foreground truncate">{row.member}</p>
                  <p className="mt-0.5 type-caption text-muted-foreground">
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
              <div className="mt-3 grid gap-2 type-label sm:grid-cols-2">
                <MetricPill label="Performance" value={formatPerformance(row)} />
                <MetricPill label="Talk time" value={formatTalkTime(row)} />
              </div>
              {row.strengths ? (
                <p className="type-label text-foreground break-words mt-3">
                  <span className="font-medium">What worked:</span> {row.strengths}
                </p>
              ) : null}
              {areasToWork(row).length > 0 ? (
                <div className="mt-3 space-y-1">
                  <p className="type-caption font-medium text-muted-foreground">
                    Areas to work
                  </p>
                  <ul className="space-y-1">
                    {areasToWork(row).map((item) => (
                      <li key={item} className="type-caption text-muted-foreground break-words">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-3 type-caption text-muted-foreground">
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
      <p className="type-caption font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 type-label text-foreground">{value}</p>
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

const BANT_DIMENSIONS: Array<keyof NonNullable<PostCallReview["bantScore"]>> = [
  "budget",
  "authority",
  "need",
  "timeline",
];

function bantBadgeVariant(status: string | undefined): "success" | "warning" | "secondary" {
  const normalized = status?.toLowerCase() ?? "";
  if (normalized === "confirmed") return "success";
  if (normalized === "partial") return "warning";
  return "secondary";
}

export function PostLearnedCard({
  learned,
  bantScore,
}: {
  learned: PostCallReview["learned"];
  bantScore?: PostCallReview["bantScore"];
}) {
  const scoreRows = BANT_DIMENSIONS.map((key) => bantScore?.[key]).filter(Boolean);
  if (scoreRows.length === 0 && learned.length === 0) return null;

  return (
    <BriefDetailCard title="BANT score">
      {scoreRows.length > 0 ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {scoreRows.map((item) =>
            item ? (
              <li key={item.label}>
                <BriefDetailRow>
                  <div className="flex items-center justify-between gap-3">
                    <p className="type-caption font-medium text-muted-foreground">{item.label}</p>
                    <Badge variant={bantBadgeVariant(item.status)} className="shrink-0">
                      {item.statusLabel ?? item.status}
                    </Badge>
                  </div>
                  {item.value ? (
                    <p className="mt-2 type-body text-foreground/90 whitespace-pre-wrap break-words">
                      {item.value}
                    </p>
                  ) : null}
                </BriefDetailRow>
              </li>
            ) : null
          )}
        </ul>
      ) : (
        <ul className="space-y-2">
          {learned.map((item) => (
            <li key={item.label}>
              <BriefDetailRow>
                <p className="type-caption font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="type-body text-foreground/90 whitespace-pre-wrap break-words mt-1">
                  {item.note}
                </p>
              </BriefDetailRow>
            </li>
          ))}
        </ul>
      )}
    </BriefDetailCard>
  );
}

const DEAL_SIGNAL_FIELDS: Array<{
  key: keyof NonNullable<PostCallReview["dealSignals"]>;
  label: string;
}> = [
  { key: "leadStage", label: "Lead stage" },
  { key: "accountsAnnualPotential", label: "Annual potential" },
  { key: "engagementModel", label: "Engagement model" },
  { key: "serviceLine", label: "Service line" },
  { key: "icpBucketCorrect", label: "Pre-DC ICP correct" },
  { key: "additionalInfo", label: "Additional info" },
];

export function PostDealSignalsCard({ signals }: { signals?: PostCallReview["dealSignals"] }) {
  const rows = DEAL_SIGNAL_FIELDS.map((field) => ({
    ...field,
    value: signals?.[field.key]?.trim(),
  })).filter((field) => field.value);
  if (rows.length === 0) return null;

  return (
    <BriefDetailCard title="Deal signals" icon={Target}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.key}>
            <BriefDetailRow>
              <p className="type-caption font-medium text-muted-foreground">{row.label}</p>
              <p className="mt-1 type-body font-medium text-foreground whitespace-pre-wrap break-words">
                {row.value}
              </p>
            </BriefDetailRow>
          </li>
        ))}
      </ul>
    </BriefDetailCard>
  );
}

export function PostDcContentSuggestionsCard({
  attachments,
  kbSuggestions = [],
}: {
  attachments?: PostCallEmailAttachments | null;
  kbSuggestions?: PostCallKbSuggestion[];
}) {
  const found = mergeFoundContent(attachments?.found ?? [], kbSuggestions);
  const missing = attachments?.missing ?? [];

  if (found.length === 0 && missing.length === 0) {
    return (
      <p className="type-body text-muted-foreground">
        Suggested KB content and missing assets appear here after wrap-up.
      </p>
    );
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <BriefDetailCard title="Suggest Content" icon={FileSearch} className="w-full">
        <p className="type-caption text-muted-foreground">
          Content available in the knowledge base that matches this call.
        </p>
        {found.length > 0 ? (
          <div className="mt-3 flex w-full min-w-0 flex-col divide-y divide-border">
            {found.map((asset) => (
              <div key={asset.assetId} className="min-w-0 py-3 first:pt-0 last:pb-0">
                <KbAttachmentCard asset={asset} variant="list" />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 type-caption text-muted-foreground">
            No matching KB assets were found for this call yet.
          </p>
        )}
      </BriefDetailCard>

      <BriefDetailCard title="Missing content" className="w-full">
        <p className="type-caption text-muted-foreground">
          Content not available in the KB — suggested to generate before follow-up or proposal.
        </p>
        {missing.length > 0 ? (
          <div className="mt-3 flex w-full min-w-0 flex-col divide-y divide-border">
            {missing.map((asset) => (
              <div key={asset.name} className="min-w-0 py-3 first:pt-0 last:pb-0">
                <MissingContentItem asset={asset} />
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 type-caption text-muted-foreground">
            No missing content was flagged for generation.
          </p>
        )}
      </BriefDetailCard>
    </div>
  );
}

function formatMissingContentReason(requiredData: string): string {
  const text = requiredData.trim();
  if (!text) return "Suggested from discovery gaps on this call.";

  const evidenceMatch = text.match(/Transcript evidence:\s*(.+)/i);
  if (evidenceMatch?.[1]) return evidenceMatch[1].trim();

  const createMatch = text.match(/Create or find:\s*(.+)/i);
  if (createMatch?.[1]) return createMatch[1].replace(/\.\s*Transcript evidence:.*$/i, "").trim();

  return text;
}

function MissingContentItem({ asset }: { asset: PostCallEmailAttachmentMissing }) {
  const reason = formatMissingContentReason(asset.requiredData);

  return (
    <div className="flex items-center gap-3 rounded-none bg-transparent px-0 py-0">
      <FilePlus2 className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate type-body font-medium text-foreground">{asset.name}</p>
        <p className="type-caption leading-snug text-muted-foreground">
          <span className="font-medium text-foreground/80">Why need to generate:</span> {reason}
        </p>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <a href={asset.contentStudioLink} aria-label={`Generate ${asset.name} in Content Studio`}>
              <Sparkles className="h-4 w-4" />
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Generate</TooltipContent>
      </Tooltip>
    </div>
  );
}

function mergeFoundContent(
  found: PostCallEmailAttachmentFound[],
  kbSuggestions: PostCallKbSuggestion[]
): PostCallEmailAttachmentFound[] {
  const seen = new Set(found.map((item) => item.assetId));
  const merged = [...found];

  for (const suggestion of kbSuggestions) {
    if (seen.has(suggestion.assetId)) continue;
    seen.add(suggestion.assetId);
    merged.push({
      name: kbSuggestionTitle(suggestion),
      assetId: suggestion.assetId,
      snippet: suggestion.snippet,
      downloadUrl: suggestion.downloadUrl ?? `/api/kb/assets/${suggestion.assetId}/file`,
      reason: suggestion.reason?.trim() || kbSuggestionReason(suggestion),
      matchScore: suggestion.score ?? undefined,
    });
  }

  return merged;
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
