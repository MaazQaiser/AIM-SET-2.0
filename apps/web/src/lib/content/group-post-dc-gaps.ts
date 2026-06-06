import type { PlannedArtifactType } from "@dc-copilot/types/brief";
import type { PostDcContentGenerationGap } from "@/lib/data/hooks";
import type { ContentGenerationLead, PreDcGenerationGroup } from "@/lib/content/group-pre-dc-gaps";
import { resolveContextualGroupTitle } from "@/lib/content/suggestion-context";

function inferArtifactType(name: string): PlannedArtifactType {
  const normalized = name.toLowerCase();
  if (normalized.includes("deck") || normalized.includes("presentation")) return "deck";
  if (normalized.includes("case study") || normalized.includes("case_study")) return "case_study";
  if (normalized.includes("one-pager") || normalized.includes("one pager") || normalized.includes("onepager")) {
    return "one_pager";
  }
  if (normalized.includes("demo")) return "demo_script";
  if (normalized.includes("battlecard")) return "battlecard";
  if (normalized.includes("architecture")) return "architecture";
  return "one_pager";
}

function buildGroupStudioHref(group: Omit<PreDcGenerationGroup, "studioHref">) {
  const params = new URLSearchParams({
    template: group.type,
    source: "post-dc",
    asset: group.name,
    leadCount: String(group.leads.length),
  });
  return `/content?tab=suggestions&${params.toString()}`;
}

function toPostDcContentGenerationLead(item: PostDcContentGenerationGap): ContentGenerationLead {
  return {
    id: item.id,
    callId: item.callId,
    accountName: item.accountName,
    leadName: item.leadName,
    industry: item.industry,
    sourcePath: item.sourcePath,
    contentRequirements: item.contentRequirements,
    context: item.context,
    name: item.name,
    type: item.type,
    reason: item.reason,
    neededFor: item.neededFor,
  };
}

export function groupPostDcGaps(items: PostDcContentGenerationGap[]): PreDcGenerationGroup[] {
  const byDocument = new Map<
    string,
    Omit<PreDcGenerationGroup, "studioHref" | "name"> & { name?: string; leads: ContentGenerationLead[] }
  >();

  for (const item of items) {
    const key = `post:${item.name.trim().toLowerCase()}`;
    const existing = byDocument.get(key);
    if (!existing) {
      byDocument.set(key, {
        id: key,
        type: item.type,
        priority: item.priority,
        status: item.status,
        reason: item.reason,
        neededFor: item.neededFor,
        leads: [toPostDcContentGenerationLead(item)],
      });
      continue;
    }

    if (existing.leads.some((lead) => lead.callId === item.callId)) continue;

    existing.leads.push(toPostDcContentGenerationLead(item));
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
        name: resolvedTitle.name || leads[0]?.name || "Content asset",
        industryLabel: resolvedTitle.industryLabel,
        leads,
      };
      return {
        ...resolved,
        studioHref: buildGroupStudioHref(resolved),
      };
    })
    .sort((a, b) => {
      if (b.leads.length !== a.leads.length) return b.leads.length - a.leads.length;
      return a.name.localeCompare(b.name);
    });
}

export function mapPostDcGapType(name: string): PlannedArtifactType {
  return inferArtifactType(name);
}
