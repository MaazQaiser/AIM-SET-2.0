import type { PreDcContentGenerationGap } from "@/lib/data/hooks";
import type { PreDcGenerationGroup } from "@/lib/content/group-pre-dc-gaps";

type GroupLeadContext = Pick<
  PreDcContentGenerationGap,
  "name" | "accountName" | "industry" | "sourceArtifactId" | "type" | "reason" | "neededFor"
>;
import type { KBAsset } from "@/types";

export interface SuggestionKbMatch {
  id: string;
  title: string;
  type: KBAsset["type"];
  fileName?: string;
}

const GENERIC_INDUSTRY_PHRASES = [
  "their industry",
  "this call",
  "the call",
  "this account",
  "the account",
];

const ARTIFACT_TITLE_BUILDERS: Record<
  string,
  (industry: string | undefined, type: PreDcContentGenerationGap["type"]) => string
> = {
  "art-deck": (industry) =>
    industry ? `${industry} services overview deck` : "Services overview deck",
  "art-case": (industry) => (industry ? `${industry} case study` : "Industry case study"),
  "art-onepager": (industry) =>
    industry ? `${industry} service one-pager` : "Service one-pager",
};

function stripAccountFromName(name: string | undefined, accountName: string | undefined) {
  let normalized = (name ?? "").trim().replace(/\s+/g, " ");
  const account = (accountName ?? "").trim();
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

function isGenericIndustry(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length < 3) return true;
  return GENERIC_INDUSTRY_PHRASES.some((phrase) => normalized.includes(phrase));
}

function normalizeIndustryLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/\.$/, "");
}

function extractIndustryFromNeededFor(neededFor: string) {
  const text = neededFor.trim();
  if (!text || isGenericIndustry(text)) return undefined;

  const patterns = [
    /(?:anchor the conversation|social proof aligned)\s+(?:to|for)\s+(.+?)(?:\.|$)/i,
    /(?:conversation|material|proof)\s+for\s+(.+?)(?:\.|$)/i,
    /for\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && !isGenericIndustry(candidate)) {
      return normalizeIndustryLabel(candidate);
    }
  }

  return undefined;
}

function extractIndustryFromReason(reason: string) {
  const text = reason.trim();
  if (!text) return undefined;

  const kbForMatch = text.match(
    /(?:upload or tag kb content for:\s*)(.+?)(?:\s+it matters|\.\s*it matters|$)/i
  );
  if (kbForMatch?.[1]) {
    const fragment = kbForMatch[1].trim();
    const caseStudy = fragment.match(/^(.+?)\s+case study/i);
    if (caseStudy?.[1]) {
      const label = caseStudy[1].trim();
      if (!isGenericIndustry(label)) return normalizeIndustryLabel(label);
    }
    if (!isGenericIndustry(fragment)) return normalizeIndustryLabel(fragment);
  }

  return undefined;
}

function extractIndustryFromAssetName(name: string, type: PreDcContentGenerationGap["type"]) {
  const normalized = name.trim();
  if (!normalized) return undefined;

  if (type === "case_study") {
    const match = normalized.match(/^(.+?)\s+case study$/i);
    if (match?.[1] && !isGenericIndustry(match[1])) {
      return normalizeIndustryLabel(match[1]);
    }
  }

  if (type === "deck") {
    const match = normalized.match(/^(.+?)\s+(?:services\s+)?(?:overview\s+)?deck$/i);
    if (match?.[1] && !isGenericIndustry(match[1])) {
      return normalizeIndustryLabel(match[1]);
    }
  }

  if (type === "one_pager") {
    const match = normalized.match(/^(.+?)\s+(?:service\s+)?one[-\s]?pager$/i);
    if (match?.[1] && !isGenericIndustry(match[1])) {
      return normalizeIndustryLabel(match[1]);
    }
  }

  return undefined;
}

export function extractIndustryFromGap(lead: GroupLeadContext): string | undefined {
  const fromCall = lead.industry?.trim();
  if (fromCall && !isGenericIndustry(fromCall)) return normalizeIndustryLabel(fromCall);

  const fromNeededFor = extractIndustryFromNeededFor(lead.neededFor ?? "");
  if (fromNeededFor) return fromNeededFor;

  const fromReason = extractIndustryFromReason(lead.reason ?? "");
  if (fromReason) return fromReason;

  const strippedName = stripAccountFromName(lead.name, lead.accountName);
  return extractIndustryFromAssetName(strippedName || lead.name, lead.type);
}

export function resolveDominantIndustry(leads: GroupLeadContext[]): string | undefined {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    const industry = extractIndustryFromGap(lead);
    if (!industry) continue;
    counts.set(industry, (counts.get(industry) ?? 0) + 1);
  }

  if (counts.size === 0) return undefined;

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topIndustry, topCount] = ranked[0] ?? [];
  const runnerUpCount = ranked[1]?.[1] ?? 0;
  if (!topIndustry || topCount === runnerUpCount) return undefined;

  return topIndustry;
}

export function resolveContextualGroupTitle(leads: GroupLeadContext[]): {
  name: string;
  industryLabel?: string;
} {
  const artifactId = leads[0]?.sourceArtifactId?.trim();
  const industryLabel = resolveDominantIndustry(leads);
  const builder = artifactId ? ARTIFACT_TITLE_BUILDERS[artifactId] : undefined;

  if (builder) {
    return { name: builder(industryLabel, leads[0]?.type ?? "one_pager"), industryLabel };
  }

  const counts = new Map<string, number>();
  for (const lead of leads) {
    const assetName = (lead.name ?? "").trim();
    if (!assetName) continue;
    const label = stripAccountFromName(assetName, lead.accountName) || assetName;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const [mostCommonName] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  return {
    name: mostCommonName ?? ((leads[0]?.name ?? "").trim() || "Content asset"),
    industryLabel,
  };
}

function assetMatchesGroupType(asset: KBAsset, groupType: PreDcGenerationGroup["type"]) {
  if (groupType === "case_study") return asset.type === "case-study";
  if (groupType === "one_pager") return asset.type === "one-pager" || asset.type === "battlecard";
  if (groupType === "deck") return asset.type === "deck";
  if (groupType === "architecture") return asset.type === "architecture";
  return asset.type === groupType.replace(/_/g, "-");
}

function scoreKbAssetForGroup(asset: KBAsset, group: PreDcGenerationGroup) {
  if (!assetMatchesGroupType(asset, group.type)) return 0;

  const haystack = `${asset.title} ${asset.tags.join(" ")} ${asset.fileName ?? ""}`.toLowerCase();
  let score = 1;

  if (group.industryLabel) {
    const tokens = group.industryLabel
      .toLowerCase()
      .split(/[\s,/]+/)
      .filter((token) => token.length > 3);
    const hits = tokens.filter((token) => haystack.includes(token)).length;
    score += hits * 2;
    if (haystack.includes(group.industryLabel.toLowerCase())) score += 4;
  }

  if (group.name && haystack.includes(group.name.toLowerCase())) score += 2;

  return score;
}

export function findKbMatchesForGroup(
  group: PreDcGenerationGroup,
  assets: KBAsset[],
  limit = 3
): SuggestionKbMatch[] {
  return assets
    .map((asset) => ({ asset, score: scoreKbAssetForGroup(asset, group) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ asset }) => ({
      id: asset.id,
      title: asset.title,
      type: asset.type,
      fileName: asset.fileName,
    }));
}

export function attachKbMatchesToGroups(
  groups: PreDcGenerationGroup[],
  assets: KBAsset[]
): PreDcGenerationGroup[] {
  return groups.map((group) => ({
    ...group,
    kbMatches: findKbMatchesForGroup(group, assets),
  }));
}
