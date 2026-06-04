import type { PreDcContentGenerationGap } from "@/lib/data/hooks";

export interface ContentGenerationLead {
  id: string;
  callId: string;
  accountName: string;
  leadName?: string;
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
  leads: ContentGenerationLead[];
}

const ARTIFACT_DISPLAY_NAMES: Record<string, string> = {
  "art-deck": "Services overview deck",
  "art-case": "Industry case study",
  "art-onepager": "Service one-pager",
};

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

export function resolveGroupDisplayName(leads: PreDcContentGenerationGap[]) {
  const artifactId = leads[0]?.sourceArtifactId?.trim();
  if (artifactId && ARTIFACT_DISPLAY_NAMES[artifactId]) {
    return ARTIFACT_DISPLAY_NAMES[artifactId];
  }

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const label = stripAccountFromName(lead.name, lead.accountName) || lead.name.trim();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const [mostCommonName] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return mostCommonName ?? leads[0]?.name ?? "Content asset";
}

function buildGroupStudioHref(group: Omit<PreDcGenerationGroup, "studioHref">) {
  const params = new URLSearchParams({
    template: group.type,
    source: "pre-dc",
    asset: group.name,
    leadCount: String(group.leads.length),
  });
  return `/content/studio?${params.toString()}`;
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
        leads: [item],
      });
      continue;
    }

    if (existing.leads.some((lead) => lead.callId === item.callId)) continue;

    existing.priority = Math.min(existing.priority, item.priority);
    existing.status =
      existing.status === "missing" || item.status === "missing" ? "missing" : "partial";
    existing.leads.push(item);
  }

  return [...byDocument.values()]
    .map((group) => {
      const leads = group.leads.sort((a, b) => {
        const accountCompare = a.accountName.localeCompare(b.accountName);
        if (accountCompare !== 0) return accountCompare;
        return (a.leadName ?? "").localeCompare(b.leadName ?? "");
      });
      const resolved = {
        ...group,
        name: resolveGroupDisplayName(leads as PreDcContentGenerationGap[]),
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
