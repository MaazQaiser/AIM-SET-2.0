import type {
  CallBrief,
  CustomerLandingPage,
  PostCallKbSuggestion,
  PostCallReview,
} from "@dc-copilot/types";
import type { Call } from "@/types";
import { sanitizeClientBullets, sanitizeClientHeadline } from "@/lib/client-facing-safety";
import { isCompanyPlaybookLandingAsset, newSectionId } from "@/lib/landing-page/clp-editor-utils";

interface BuildOptimisticLandingDraftInput {
  callId: string;
  call?: Call | null;
  review?: PostCallReview | null;
  brief?: CallBrief | null;
  kbSuggestions?: PostCallKbSuggestion[];
}

/** Instant client-side draft while the server generates the persisted landing page. */
export function buildOptimisticLandingDraft({
  callId,
  call,
  review,
  brief,
  kbSuggestions = [],
}: BuildOptimisticLandingDraftInput): CustomerLandingPage {
  const account = call?.accountName ?? "your team";
  const lead = call?.leadName ?? "";
  const headline = sanitizeClientHeadline(review?.headline ?? "", account);
  const bullets = sanitizeClientBullets(review?.summary ?? [], [
    `We discussed priorities for ${account} and agreed on follow-up materials.`,
  ]);

  const sections: CustomerLandingPage["sections"] = [
    {
      id: newSectionId(),
      type: "hero",
      visible: true,
      headline,
      subhead: `Personalized follow-up for ${lead || account}`,
    },
    {
      id: newSectionId(),
      type: "summary",
      visible: true,
      title: "What we discussed",
      bullets,
    },
    {
      id: newSectionId(),
      type: "next_steps",
      visible: true,
      title: "Next steps",
      bullets: [
        "Review the materials shared on this page.",
        "Share any questions with your account team.",
        "Schedule a follow-up to align on scope and timing.",
      ],
    },
    {
      id: newSectionId(),
      type: "ae_contact",
      visible: true,
      title: "Your account team",
    },
  ];

  const selectedAssets: CustomerLandingPage["selectedAssets"] = [];
  const aiSuggestions: CustomerLandingPage["aiSuggestions"] = [];

  for (const suggestion of kbSuggestions) {
    if (!suggestion.assetId) continue;
    if (isCompanyPlaybookLandingAsset({ title: suggestion.title })) continue;
    aiSuggestions.push({
      assetId: suggestion.assetId,
      title: suggestion.title ?? "Reference",
      reason: suggestion.reason ?? "Relevant to your discovery conversation",
      confidence: suggestion.score ?? 0.7,
    });
    if (selectedAssets.length < 4) {
      selectedAssets.push({
        assetId: suggestion.assetId,
        title: suggestion.title ?? "Reference",
        displayMode: "embed",
      });
    }
    if (aiSuggestions.length >= 4) break;
  }

  if (selectedAssets.length > 0) {
    sections.splice(3, 0, {
      id: newSectionId(),
      type: "asset",
      visible: true,
      title: "Shared resources",
      assetIds: selectedAssets.map((asset) => asset.assetId),
    });
  }

  const deck = brief?.recommendedDeck;
  if (deck?.assetId) {
    sections.push({
      id: newSectionId(),
      type: "company_deck",
      visible: true,
      title: "Company overview",
      assetId: deck.assetId,
    });
  }

  const now = new Date().toISOString();

  return {
    id: `optimistic-${callId}`,
    callId,
    ownerUserId: "",
    status: "draft",
    shareToken: "",
    version: 0,
    branding: {
      accountName: account,
      leadName: lead || undefined,
    },
    sections,
    selectedAssets,
    aiSuggestions,
    settings: {
      requireIdentityEachVisit: true,
      allowComments: true,
      allowChat: true,
      notifyAeOnActivity: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}
