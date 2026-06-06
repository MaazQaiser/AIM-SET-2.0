import type { Citation, PodRole } from "@/types";

export type BotChatMode = "direct" | "group" | "copilot";

export type BotChatPhase = "prep" | "live" | "wrapup";

export interface SuggestedAction {
  id: string;
  label: string;
  prompt: string;
  category: "prepare" | "live" | "follow-up";
}

export interface BotChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
  authorName?: string;
  authorRole?: PodRole;
  authorInitials?: string;
  createdAt: number;
  /** Direct mode only — never shown in group thread */
  isPrivate?: boolean;
}
