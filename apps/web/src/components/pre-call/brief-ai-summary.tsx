"use client";

import { Sparkles } from "lucide-react";
import { useWidgetSize } from "@/components/dashboard-grid/dashboard-widget";
import { BriefDetailCard, briefMainBody } from "@/components/pre-call/brief-detail-card";
import { parseSummaryHighlights, type SummaryHighlightRule } from "@/lib/brief-summary-highlights";
import { useAgentConfig } from "@/lib/data/agent-config-hooks";
import { companyStageForCall, type CompanyStage } from "@/lib/dc-notes/company-stage";
import { companyRatingForCall, formatCompanyRating } from "@/lib/dc-notes/icp-rating";
import { useThemePreview } from "@/hooks/use-theme-preview";
import {
  SUMMARY_SECTION_ORDER,
  SUMMARY_SECTION_TITLES,
  normalizeSummarySections,
  type BriefSummarySection,
  type CallBrief,
} from "@dc-copilot/types/brief";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

interface BriefAISummaryProps {
  brief: CallBrief;
  call?: Call;
}

const STAGE_BADGE_CLASS: Record<CompanyStage, string> = {
  Enterprise: "border-violet-300/80 bg-violet-50/90 text-violet-900",
  Startup: "border-sky-300/80 bg-sky-50/90 text-sky-900",
  "Funded Startup": "border-indigo-300/80 bg-indigo-50/90 text-indigo-900",
  Ideation: "border-amber-300/80 bg-amber-50/90 text-amber-950",
  SMB: "border-teal-300/80 bg-teal-50/90 text-teal-900",
};
const NEEDS_CONTENT_FALLBACK = "Needs/content is not identified yet.";

function sortedRelevantProjects(brief: CallBrief): NonNullable<CallBrief["relevantProjects"]> {
  return [...(brief.relevantProjects ?? [])].sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
  );
}

function projectNamesSentence(brief: CallBrief): string {
  const names = sortedRelevantProjects(brief)
    .map((project) => project.title?.trim())
    .filter((title, index, all): title is string => Boolean(title) && all.indexOf(title) === index);
  if (names.length === 0) {
    return "Relevant projects done: 0.";
  }
  const shown = names.slice(0, 5);
  const suffix = names.length > shown.length ? `, +${names.length - shown.length} more` : "";
  const projectWord = names.length === 1 ? "project" : "projects";
  return `Relevant ${projectWord} done: ${names.length} - ${shown.join(", ")}${suffix}.`;
}

function fallbackRelevanceText(brief: CallBrief): string {
  const projects = sortedRelevantProjects(brief);
  const scores = [
    ...projects.map((project) => project.relevanceScore ?? 0),
    ...(brief.relevantDocuments ?? []).map((document) => document.relevanceScore ?? 0),
  ].filter((score) => score > 0);
  const projectsSentence = projectNamesSentence(brief);

  if (scores.length === 0) {
    return `${projectsSentence} Overall relevance score is not available yet.`;
  }

  const pct = Math.round(Math.max(...scores) * 100);
  return `${projectsSentence} Overall relevance: ${pct}%.`;
}

function withoutOutreachDetails(value: string): string {
  const blockedPatterns = [
    "outreach",
    "cold email",
    "email campaign",
    "email and phone",
    "phone and email",
    "via email",
    "via phone",
    "lead source",
    "how we landed",
    "how we got",
    "responded",
    "reply",
    "openness to a call",
    "bandwidth",
    "unresponsive",
    "follow-up",
    "follow up",
    "re-engaged",
    "reengaged",
    "scheduled",
    "scheduling",
    "schedule the call",
    "booked",
    "availability",
    "calendar invite",
    "meeting invite",
    "meeting has been confirmed",
    "meeting confirmed",
    "discovery call",
    "intro call",
    "prior to the call",
    "nda",
    "company details",
    "prospect is",
    "founder & ceo",
    "founder and ceo",
  ];
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence &&
        !blockedPatterns.some((pattern) => sentence.toLowerCase().includes(pattern)),
    )
    .join(" ");
}

function extractNeedPhrase(value: string): string {
  const text = value.replace(/\s+/g, " ").trim();
  const patterns = [
    /\b(?:would\s+)?need(?:s|ed)?(?:\s+(?:is|are|to))?\s+(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)/i,
    /\b(?:want|wants|wanted|looking for|seeking|requires?|requested|interested in|would like)\s+(?:to\s+)?(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)/i,
    /\b(?:goal|objective)\s+(?:is|was)\s+(?:to\s+)?(.+?)(?:,?\s+(?:though|but|however)\b|[.!?]|$)/i,
  ];
  for (const pattern of patterns) {
    const need = text.match(pattern)?.[1]?.trim().replace(/^[,;:\s-]+|[,;:\s-]+$/g, "");
    if (need) return need.replace(/\.$/, "");
  }
  return "";
}

function normalizeNeedText(value: string): string {
  return value
    .trim()
    .replace(
      /^(?:their\s+)?(?:stated\s+)?(?:need|needs|needed|want|wants|wanted|looking for|seeking|requires?|requested|interested in)(?:\s+(?:is|are|to))?\s+/i,
      ""
    )
    .replace(/\.$/, "");
}

function businessNeedText(value: string, allowPlain = false): string {
  const clean = withoutOutreachDetails(value);
  const extracted = extractNeedPhrase(clean) || extractNeedPhrase(value);
  if (extracted) return normalizeNeedText(extracted);
  if (allowPlain && clean) return normalizeNeedText(clean);
  return "";
}

function painPointText(value: string, allowPlain = false): string {
  const clean = withoutOutreachDetails(value);
  const painPatterns = [
    "pain",
    "challenge",
    "issue",
    "problem",
    "friction",
    "slow",
    "slows",
    "manual",
    "bottleneck",
    "gap",
    "blocker",
    "struggle",
    "difficulty",
    "risk",
    "unable",
    "lack",
    "lacks",
  ];
  const matches = clean
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim().replace(/\.$/, ""))
    .filter(
      (sentence) =>
        sentence && painPatterns.some((pattern) => sentence.toLowerCase().includes(pattern))
    );
  if (matches.length > 0) return matches.join("; ");
  if (allowPlain && clean) return normalizeNeedText(clean);
  return "";
}

function fallbackCustomerProfileText(brief: CallBrief): string {
  const legacySummary = withoutOutreachDetails(brief.aiSummary ?? "");
  const needs = (brief.pains ?? [])
    .map((pain) => businessNeedText(pain.text ?? "", true))
    .filter(Boolean)
    .slice(0, 2);
  if (!legacySummary && needs.length === 0) {
    return NEEDS_CONTENT_FALLBACK;
  }
  return [
    legacySummary || `${brief.accountName} has limited company profile detail captured.`,
    needs.length > 0 ? `Their stated need is ${needs.join("; ")}.` : NEEDS_CONTENT_FALLBACK,
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackPainPointsText(brief: CallBrief): string {
  const pains = (brief.pains ?? [])
    .map((pain) => painPointText(pain.text ?? ""))
    .filter(Boolean)
    .slice(0, 3);
  return pains.length > 0 ? pains.join("; ") : NEEDS_CONTENT_FALLBACK;
}

function cleanCustomerProfileSection(section: BriefSummarySection, brief: CallBrief): BriefSummarySection {
  const cleanContent = withoutOutreachDetails(section.content ?? "");
  const needFromSection = businessNeedText(section.content ?? "");
  const fallbackNeed = (brief.pains ?? [])
    .map((pain) => businessNeedText(pain.text ?? "", true))
    .find(Boolean);
  const need = normalizeNeedText(needFromSection || fallbackNeed || "");
  const content = [
    cleanContent || `${brief.accountName} has limited company profile detail captured.`,
    need ? `Their stated need is ${need}.` : NEEDS_CONTENT_FALLBACK,
  ]
    .filter(Boolean)
    .join(" ");

  return { ...section, content };
}

function cleanPainPointsSection(section: BriefSummarySection, brief: CallBrief): BriefSummarySection {
  const pain = painPointText(section.content ?? "");
  return { ...section, content: pain || fallbackPainPointsText(brief) };
}

function cleanRelevanceSection(section: BriefSummarySection, brief: CallBrief): BriefSummarySection {
  const hasKbMatch =
    (brief.relevantProjects?.length ?? 0) > 0 || (brief.relevantDocuments?.length ?? 0) > 0;
  return hasKbMatch ? { ...section, content: fallbackRelevanceText(brief) } : section;
}

function cleanSummarySection(section: BriefSummarySection, brief: CallBrief): BriefSummarySection {
  if (section.id === "customer_profile") {
    return cleanCustomerProfileSection(section, brief);
  }
  if (section.id === "customer_pain_points") {
    return cleanPainPointsSection(section, brief);
  }
  if (section.id === "relevance") {
    return cleanRelevanceSection(section, brief);
  }
  return section;
}

function resolveSummarySections(brief: CallBrief): BriefSummarySection[] {
  const fallbackSections: BriefSummarySection[] = [
    {
      id: "customer_profile",
      title: SUMMARY_SECTION_TITLES.customer_profile,
      content: fallbackCustomerProfileText(brief),
    },
    {
      id: "customer_pain_points",
      title: SUMMARY_SECTION_TITLES.customer_pain_points,
      content: fallbackPainPointsText(brief),
    },
    {
      id: "suggested_action",
      title: "Approach towards client",
      content: "No generated suggested action paragraph is available yet.",
    },
    {
      id: "relevance",
      title: "Relevance",
      content: fallbackRelevanceText(brief),
    },
  ];

  const sections = (brief.summarySections ?? []).filter((section) => section.content?.trim());
  if (sections.length > 0) {
    const byId = new Map(
      sections.map((section) => [section.id, cleanSummarySection(section, brief)])
    );
    const fallbackById = Object.fromEntries(
      fallbackSections.map((section) => [section.id, section]),
    ) as Record<BriefSummarySection["id"], BriefSummarySection>;
    return normalizeSummarySections(
      SUMMARY_SECTION_ORDER.map((id) => byId.get(id) ?? fallbackById[id])
    )!;
  }

  return normalizeSummarySections(fallbackSections)!;
}

function ValueBadge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-0.5 type-label",
        className
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function splitBriefIcpNote(brief: CallBrief): { companyType?: string; review?: string } {
  const segments =
    brief.icpNote
      ?.split("·")
      .map((segment) => segment.trim())
      .filter(Boolean) ?? [];

  return {
    companyType: segments[0],
    review: segments[1] ?? segments[0],
  };
}

function summaryStatsContext(brief: CallBrief, call?: Call) {
  const note = splitBriefIcpNote(brief);
  const companyType = call?.companyTypeIcp?.trim() || note.companyType || "Not captured";
  const icpBucket = call?.icpBucket?.trim() || note.review;
  const stage = companyStageForCall({
    id: call?.id ?? brief.callId,
    dealStage: call?.dealStage ?? brief.dealStage,
    companyTypeIcp: call?.companyTypeIcp ?? companyType,
    icpBucket,
    annualRevenueRaw: call?.annualRevenueRaw,
    employeeCount: call?.employeeCount,
  });
  const agentRating = formatCompanyRating(
    companyRatingForCall({
      id: call?.id ?? brief.callId,
      icpMatch: call?.icpMatch ?? brief.icpMatch,
      icpBucket,
    })
  );

  const revenue =
    call?.annualRevenue?.trim() ||
    brief.opportunityValue?.replace(/\s*annual revenue$/i, "").trim() ||
    "—";

  return {
    agentRating,
    companyType,
    stage,
    revenue,
  };
}

function HighlightedSummary({
  text,
  clamp,
  rules,
  intercomMarks,
}: {
  text: string;
  clamp?: boolean;
  rules?: SummaryHighlightRule[];
  intercomMarks?: boolean;
}) {
  const parts = parseSummaryHighlights(text, rules);
  let offset = 0;
  const keyedParts = parts.map((part) => {
    const key = `${offset}-${part.value}`;
    offset += part.value.length;
    return { ...part, key };
  });

  return (
    <p
      className={cn(
        briefMainBody,
        "break-words",
        intercomMarks ? "text-[#111111]" : "text-foreground/90",
        clamp && "line-clamp-6"
      )}
    >
      {keyedParts.map((part) =>
        part.type === "highlight" ? (
          <mark
            key={part.key}
            className={cn(
              intercomMarks
                ? "rounded px-0.5 bg-[#ebe7e1] text-[#111111] font-bold underline decoration-[#111111]/30 underline-offset-2"
                : part.className,
              !intercomMarks && "font-bold underline decoration-foreground/35 underline-offset-2"
            )}
          >
            {part.value}
          </mark>
        ) : (
          <span key={part.key}>{part.value}</span>
        )
      )}
    </p>
  );
}

export function BriefAISummary({ brief, call }: BriefAISummaryProps) {
  const { isIntercom } = useThemePreview();
  const { data: workflowConfig } = useAgentConfig("workflow");
  const highlightRules = workflowConfig?.summary_highlight_rules;

  const { compact, columnZone } = useWidgetSize();
  const isCenter = columnZone === "center";
  const summarySections = resolveSummarySections(brief);
  const stats = summaryStatsContext(brief, call);

  const statsBadges = (
    <div className="ml-auto flex min-w-0 max-w-[min(72%,44rem)] flex-nowrap items-center justify-end gap-1.5 overflow-hidden whitespace-nowrap">
      <ValueBadge
        className={cn(
          "shrink-0",
          STAGE_BADGE_CLASS[stats.stage] ?? "border-border bg-muted/40 text-foreground"
        )}
      >
        {stats.stage}
      </ValueBadge>
      <ValueBadge className="shrink-0 bg-warning/10 border-warning/25 text-foreground">
        {stats.agentRating}
      </ValueBadge>
      <ValueBadge className="min-w-0 flex-1 border-border bg-muted/40 text-foreground">
        {stats.companyType}
      </ValueBadge>
      {stats.revenue !== "—" && (
        <ValueBadge className="shrink-0 bg-warning/15 border-warning/20 text-foreground font-semibold">
          {stats.revenue}
        </ValueBadge>
      )}
    </div>
  );

  return (
    <BriefDetailCard
      tone="main"
      title="Summary"
      icon={Sparkles}
      variant="highlight"
      headerExtra={statsBadges}
      sourceInfo={{
        source: "AI from Pre-DC lead data",
        detail:
          "The workflow summarizes imported lead research into one readout. The relevance section shows relevant project count, project names, and the overall KB match percentage.",
      }}
    >
      <div className="space-y-3 min-w-0">
          {summarySections.map((section) => (
            <section
              key={section.id}
              className="space-y-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0"
            >
              <p className="type-label text-muted-foreground">
                {section.title}
              </p>
              <HighlightedSummary
                text={section.content}
                clamp={!isCenter && compact}
                rules={highlightRules}
                intercomMarks={isIntercom}
              />
            </section>
          ))}
      </div>
    </BriefDetailCard>
  );
}
