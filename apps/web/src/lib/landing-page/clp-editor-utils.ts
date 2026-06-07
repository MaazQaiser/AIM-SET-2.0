import type {
  ClpAssetRef,
  ClpQuickLink,
  ClpSection,
  ClpSectionType,
  CustomerLandingPage,
} from "@dc-copilot/types";

export const CLP_SECTION_TYPE_OPTIONS: { value: ClpSectionType; label: string }[] = [
  { value: "hero", label: "Hero" },
  { value: "summary", label: "What we discussed" },
  { value: "next_steps", label: "Next steps" },
  { value: "asset", label: "Shared resources" },
  { value: "company_deck", label: "Company deck" },
  { value: "quick_links", label: "Quick links" },
  { value: "testimonials", label: "Testimonials" },
  { value: "ae_contact", label: "Account team" },
];

export function isCompanyPlaybookLandingAsset(asset?: {
  title?: string | null;
  fileName?: string | null;
}) {
  const label = `${asset?.title ?? ""} ${asset?.fileName ?? ""}`;
  return /\bcompany[\s_-]+playbook\b/i.test(label);
}

export function sectionTypeLabel(type: ClpSectionType): string {
  return CLP_SECTION_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type.replace(/_/g, " ");
}

export function newSectionId(): string {
  return `sec-${crypto.randomUUID().slice(0, 8)}`;
}

export function createClpSection(type: ClpSectionType): ClpSection {
  const id = newSectionId();
  const base = { id, type, visible: true as const };

  switch (type) {
    case "hero":
      return {
        ...base,
        headline: "Your discovery follow-up",
        subhead: "Personalized for your team",
      };
    case "summary":
      return { ...base, title: "What we discussed", bullets: ["Add a key point from the call."] };
    case "next_steps":
      return {
        ...base,
        title: "Next steps",
        bullets: ["Review shared materials.", "Reply with questions."],
      };
    case "asset":
      return { ...base, title: "Shared resources", assetIds: [], caption: "" };
    case "company_deck":
      return { ...base, title: "Company overview", assetId: undefined };
    case "quick_links":
      return {
        ...base,
        title: "Quick links",
        links: [{ label: "Schedule follow-up", url: "https://example.com" }],
      };
    case "testimonials":
      return {
        ...base,
        title: "What customers say",
        bullets: ["Add a customer quote or proof point."],
      };
    case "ae_contact":
      return { ...base, title: "Your account team" };
    default:
      return { ...base, title: sectionTypeLabel(type) };
  }
}

export function syncAssetSections(page: CustomerLandingPage): CustomerLandingPage {
  const originalSelectedAssets = page.selectedAssets ?? [];
  const originalAiSuggestions = page.aiSuggestions ?? [];
  const selectedAssets = originalSelectedAssets.filter(
    (asset) => !isCompanyPlaybookLandingAsset(asset)
  );
  const aiSuggestions = originalAiSuggestions.filter(
    (asset) => !isCompanyPlaybookLandingAsset(asset)
  );
  const blockedAssetIds = new Set(
    [...originalSelectedAssets, ...originalAiSuggestions]
      .filter((asset) => isCompanyPlaybookLandingAsset(asset))
      .map((asset) => asset.assetId)
  );
  const sections = page.sections ?? [];
  const ids = selectedAssets.map((a) => a.assetId);
  return {
    ...page,
    selectedAssets,
    aiSuggestions,
    sections: sections.map((s) => {
      if (s.type === "asset") {
        return { ...s, assetIds: ids };
      }
      if (s.assetId && blockedAssetIds.has(s.assetId)) {
        return { ...s, assetId: undefined };
      }
      return s;
    }),
  };
}

export function toggleSelectedAsset(
  page: CustomerLandingPage,
  asset: { assetId: string; title: string }
): CustomerLandingPage {
  if (isCompanyPlaybookLandingAsset(asset)) return syncAssetSections(page);
  const exists = page.selectedAssets.some((s) => s.assetId === asset.assetId);
  const selectedAssets: ClpAssetRef[] = exists
    ? page.selectedAssets.filter((s) => s.assetId !== asset.assetId)
    : [
        ...page.selectedAssets,
        { assetId: asset.assetId, title: asset.title, displayMode: "embed" },
      ];
  return syncAssetSections({ ...page, selectedAssets });
}

export function bulletsToText(bullets?: string[]): string {
  return (bullets ?? []).join("\n");
}

export function textToBullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function linksToText(links?: ClpQuickLink[]): string {
  return (links ?? []).map((l) => `${l.label}|${l.url}`).join("\n");
}

export function textToLinks(text: string): ClpQuickLink[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, url] = line.split("|").map((p) => p.trim());
      return { label: label || "Link", url: url || "#" };
    });
}
