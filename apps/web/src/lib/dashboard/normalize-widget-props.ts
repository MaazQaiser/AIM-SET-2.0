import { normalizeSummarySections } from "@dc-copilot/types/brief";
import type {
  CallBrief,
  PostCallEmailDraft,
  PostCallJiraTicket,
  PostCallKbSuggestion,
  PostCallReview,
  PostCallTask,
} from "@/lib/brief-types";
import type { BriefWidgetProps, PostDcWidgetProps } from "@/lib/dashboard/widget-registry";
import type { AccountSnapshotRow } from "@/components/calls/account-widget-cards";
export function arrayLen(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function normalizeCallBrief(brief: CallBrief): CallBrief {
  return {
    ...brief,
    summarySections: normalizeSummarySections(brief.summarySections) ?? [],
    newSignals: brief.newSignals ?? [],
    clientAttendees: brief.clientAttendees ?? [],
    internalAttendees: brief.internalAttendees ?? [],
    interactionHistory: brief.interactionHistory ?? [],
    pains: brief.pains ?? [],
    objections: brief.objections ?? [],
    deckSlides: brief.deckSlides ?? [],
    preDeck: brief.preDeck,
    podNotes: brief.podNotes ?? [],
    researchSections: brief.researchSections ?? [],
    relevantDocuments: brief.relevantDocuments ?? [],
    relevantProjects: brief.relevantProjects ?? [],
    recommendedDeck: brief.recommendedDeck,
    artifactPlan: brief.artifactPlan ?? [],
    artifactFulfillment: brief.artifactFulfillment ?? [],
    contentToGenerate: brief.contentToGenerate ?? [],
  };
}

export function normalizePostCallReview(review: PostCallReview): PostCallReview {
  return {
    ...review,
    summary: review.summary ?? [],
    podScorecard: review.podScorecard ?? [],
    learned: review.learned ?? [],
    bantScore: review.bantScore ?? {},
    dealSignals: review.dealSignals ?? {},
    researchSections: review.researchSections ?? [],
    openDiscoveryGaps: review.openDiscoveryGaps ?? [],
  };
}

export function normalizeBriefWidgetProps(
  props: Omit<BriefWidgetProps, "brief" | "discoveryQuestions" | "accountSnapshot"> & {
    brief: CallBrief;
    discoveryQuestions?: string[] | null;
    accountSnapshot?: AccountSnapshotRow[] | null;
  }
): BriefWidgetProps {
  return {
    ...props,
    brief: normalizeCallBrief(props.brief),
    discoveryQuestions: Array.isArray(props.discoveryQuestions) ? props.discoveryQuestions : [],
    accountSnapshot: Array.isArray(props.accountSnapshot) ? props.accountSnapshot : [],
  };
}

export function normalizePostDcWidgetProps(
  props: Omit<PostDcWidgetProps, "review" | "accountSnapshot"> & {
    review: PostCallReview;
    callId: string;
    accountSnapshot?: AccountSnapshotRow[] | null;
    emailDraft?: PostCallEmailDraft | null;
    internalEmailDraft?: PostCallEmailDraft | null;
    crmTasks?: PostCallTask[] | null;
    jiraTicket?: PostCallJiraTicket | null;
    kbSuggestions?: PostCallKbSuggestion[] | null;
    emailAttachments?: PostCallEmailDraft["attachments"];
    landingPage?: import("@dc-copilot/types").CustomerLandingPage | null;
  }
): PostDcWidgetProps {
  return {
    ...props,
    review: normalizePostCallReview(props.review),
    callId: props.callId,
    accountSnapshot: Array.isArray(props.accountSnapshot) ? props.accountSnapshot : [],
    emailDraft: props.emailDraft ?? null,
    internalEmailDraft: props.internalEmailDraft ?? null,
    crmTasks: Array.isArray(props.crmTasks) ? props.crmTasks : [],
    jiraTicket: props.jiraTicket ?? null,
    kbSuggestions: Array.isArray(props.kbSuggestions) ? props.kbSuggestions : [],
    emailAttachments: props.emailAttachments,
    landingPage: props.landingPage ?? null,
  };
}
