/** Customer Landing Page (CLP) types */

export type ClpStatus = "draft" | "published" | "revoked";

export type ClpSectionType =
  | "hero"
  | "summary"
  | "next_steps"
  | "company_deck"
  | "portfolio"
  | "testimonials"
  | "quick_links"
  | "asset"
  | "proposal"
  | "ae_contact";

export interface ClpQuickLink {
  label: string;
  url: string;
  icon?: string;
}

export interface ClpAssetRef {
  assetId: string;
  title: string;
  kind?: string;
  displayMode?: "embed" | "card" | "download";
  caption?: string;
}

export interface ClpSuggestion {
  assetId: string;
  title: string;
  reason: string;
  confidence?: number;
}

export interface ClpSection {
  id: string;
  type: ClpSectionType;
  visible: boolean;
  title?: string;
  headline?: string;
  subhead?: string;
  bullets?: string[];
  links?: ClpQuickLink[];
  assetId?: string;
  assetIds?: string[];
  caption?: string;
}

export interface ClpBranding {
  accountName: string;
  leadName?: string;
  logoUrl?: string;
  aeName?: string;
  aeEmail?: string;
}

export interface ClpSettings {
  requireIdentityEachVisit?: boolean;
  allowComments?: boolean;
  allowChat?: boolean;
  notifyAeOnActivity?: boolean;
}

export interface CustomerLandingPage {
  id: string;
  callId: string;
  tenantId?: string;
  ownerUserId: string;
  status: ClpStatus;
  shareToken: string;
  publishedAt?: string;
  revokedAt?: string;
  version: number;
  branding: ClpBranding;
  sections: ClpSection[];
  selectedAssets: ClpAssetRef[];
  aiSuggestions: ClpSuggestion[];
  settings: ClpSettings;
  proposalId?: string;
  createdAt: string;
  updatedAt: string;
  /** Populated on read for AE */
  publicUrl?: string;
  stats?: ClpStats;
}

export interface ClpStats {
  linkOpens: number;
  uniqueVisitors: number;
  returnVisits: number;
  documentOpens: number;
  proposalOpens: number;
  identitySubmissions?: number;
  unreadNotifications: number;
}

export type ClpProposalStatus = "draft" | "approved" | "published_on_clp";

export interface ClpProposal {
  id: string;
  landingPageId: string;
  callId: string;
  status: ClpProposalStatus;
  version: number;
  title: string;
  html: string;
  sections: { id: string; title: string; bodyHtml?: string }[];
  citations: { source: string; label: string }[];
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClpVisitor {
  id: string;
  landingPageId: string;
  email: string;
  name: string;
  title?: string;
  visitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  proposalViewed?: boolean;
  documentsOpened?: string[];
}

export type ClpEventType =
  | "link_opened"
  | "password_success"
  | "identity_submitted"
  | "page_view"
  | "section_viewed"
  | "document_opened"
  | "document_page_viewed"
  | "document_closed"
  | "document_downloaded"
  | "proposal_opened"
  | "proposal_section_viewed"
  | "proposal_closed"
  | "chat_message_sent"
  | "comment_created"
  | "comment_replied"
  | "comment_resolved"
  | "link_click";

export interface ClpEvent {
  id: string;
  landingPageId: string;
  sessionId?: string;
  visitorId?: string;
  eventType: ClpEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface ClpNotification {
  id: string;
  landingPageId: string;
  callId: string;
  recipientUserId: string;
  notificationType: string;
  summary: string;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface ClpComment {
  id: string;
  landingPageId: string;
  sectionId?: string;
  authorType: "visitor" | "ae";
  authorName: string;
  body: string;
  status: "open" | "resolved";
  parentId?: string;
  createdAt: string;
}

export interface ClpChatMessage {
  id: string;
  landingPageId: string;
  visitorId: string;
  authorType: "visitor" | "ae";
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ClpActivityRollup {
  events: ClpEvent[];
  visitors: ClpVisitor[];
  metrics: ClpStats;
}

export interface ClpOrgAnalytics {
  publishedCount: number;
  totalLinkOpens: number;
  totalUniqueVisitors: number;
  proposalViewRate: number;
  topAccounts: { accountName: string; callId: string; engagementScore: number }[];
  funnel: {
    published: number;
    linkOpened: number;
    identitySubmitted: number;
    documentOpened: number;
    proposalOpened: number;
  };
}
