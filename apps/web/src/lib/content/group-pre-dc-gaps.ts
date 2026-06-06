import type { PreDcContentGenerationGap } from "@/lib/data/hooks";
import { resolveContextualGroupTitle } from "@/lib/content/suggestion-context";
import type {
  ContentSuggestionEvidenceSource,
  ContentSuggestionSlidePlan,
  RelevantDocument,
  RelevantProject,
} from "@dc-copilot/types/brief";

export interface ContentGenerationLead {
  id: string;
  callId: string;
  accountName: string;
  leadName?: string;
  industry?: string;
  name: string;
  sourceArtifactId?: string;
  type: PreDcContentGenerationGap["type"];
  reason: string;
  neededFor: string;
  relevantProjects?: RelevantProject[];
  relevantDocuments?: RelevantDocument[];
  recommendedDeck?: RelevantDocument | null;
  evidence?: ContentSuggestionEvidenceSource[];
  slidePlan?: ContentSuggestionSlidePlan[];
}

function toContentGenerationLead(item: PreDcContentGenerationGap): ContentGenerationLead {
  return {
    id: item.id,
    callId: item.callId,
    accountName: item.accountName,
    leadName: item.leadName,
    industry: item.industry,
    name: item.name,
    sourceArtifactId: item.sourceArtifactId,
    type: item.type,
    reason: item.reason,
    neededFor: item.neededFor,
    relevantProjects: item.relevantProjects,
    relevantDocuments: item.relevantDocuments,
    recommendedDeck: item.recommendedDeck,
    evidence: item.evidence,
    slidePlan: item.slidePlan,
  };
}

export interface PreDcGenerationGroup {
  id: string;
  name: string;
  type: PreDcContentGenerationGap["type"];
  priority: number;
  status: PreDcContentGenerationGap["status"];
  reason: string;
  neededFor: string;
  studioHref: string;
  industryLabel?: string;
  kbMatches?: import("@/lib/content/suggestion-context").SuggestionKbMatch[];
  leads: ContentGenerationLead[];
}

function stripAccountFromName(name: string, accountName: string) {
  let normalized = name.trim().replace(/\s+/g, " ");
  const account = accountName.trim();
  if (!account) return normalized;

  const accountLower = account.toLowerCase();
  const nameLower = normalized.toLowerCase();
  if (nameLower.startsWith(accountLower)) {
    normalized = normalized.slice(account.length).replace(/^[\s\-–—:|]+/, "").trim();
  }
  const forAccount = new RegExp(`\\s+for\\s+${account.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  normalized = normalized.replace(forAccount, "").trim();
  return normalized;
}

export function normalizeDocumentKey(item: PreDcContentGenerationGap) {
  const artifactId = item.sourceArtifactId?.trim();
  if (artifactId) return `artifact:${artifactId}`;

  const strippedName = stripAccountFromName(item.name, item.accountName);
  const normalizedName = (strippedName || item.type).toLowerCase();
  return `${item.type}:${normalizedName}`;
}

function buildGroupStudioHref(group: Omit<PreDcGenerationGroup, "studioHref">) {
  const params = new URLSearchParams({
    template: group.type,
    source: "pre-dc",
    asset: group.name,
    leadCount: String(group.leads.length),
  });
  return `/content?tab=suggestions&${params.toString()}`;
}

export function groupPreDcGaps(items: PreDcContentGenerationGap[]): PreDcGenerationGroup[] {
  const byDocument = new Map<string, Omit<PreDcGenerationGroup, "studioHref" | "name"> & { name?: string }>();

  for (const item of items) {
    const key = normalizeDocumentKey(item);
    const existing = byDocument.get(key);
    if (!existing) {
      byDocument.set(key, {
        id: key,
        type: item.type,
        priority: item.priority,
        status: item.status,
        reason: item.reason,
        neededFor: item.neededFor,
        leads: [toContentGenerationLead(item)],
      });
      continue;
    }

    if (existing.leads.some((lead) => lead.callId === item.callId)) continue;

    existing.priority = Math.min(existing.priority, item.priority);
    existing.status =
      existing.status === "missing" || item.status === "missing" ? "missing" : "partial";
    existing.leads.push(toContentGenerationLead(item));
  }

  return [...byDocument.values()]
    .map((group) => {
      const leads = group.leads.sort((a, b) => {
        const accountCompare = a.accountName.localeCompare(b.accountName);
        if (accountCompare !== 0) return accountCompare;
        return (a.leadName ?? "").localeCompare(b.leadName ?? "");
      });
      const resolvedTitle = resolveContextualGroupTitle(leads);
      const resolved = {
        ...group,
        name: resolvedTitle.name,
        industryLabel: resolvedTitle.industryLabel,
        leads,
      };
      return {
        ...resolved,
        studioHref: buildGroupStudioHref(resolved),
      };
    })
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (b.leads.length !== a.leads.length) return b.leads.length - a.leads.length;
      return a.name.localeCompare(b.name);
    });
}
