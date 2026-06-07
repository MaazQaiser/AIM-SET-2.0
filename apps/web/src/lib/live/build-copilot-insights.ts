import { copyTextToClipboard } from "@/lib/clipboard";
import type {
  CustomerSentimentCue,
  NudgePayload,
  ObjectionPayload,
  UnansweredQuestionPayload,
} from "@/types";
import { toast } from "sonner";

export type LiveInsightKind = "insight" | "question" | "alert";

export interface LiveInsightLine {
  id: string;
  label: string;
  kind: LiveInsightKind;
  message: string;
  details?: string[];
  gotItLabel?: string;
  onGotIt?: () => void;
  onDismiss?: () => void;
}

interface BuildCopilotInsightsInput {
  customerSentiment: CustomerSentimentCue | null;
  nudges: NudgePayload[];
  objections: ObjectionPayload[];
  unansweredQuestions: UnansweredQuestionPayload[];
  onAcceptNudge: (id: string) => void;
  onDismissNudge: (id: string) => void;
}

function copyWithToast(text: string) {
  void copyTextToClipboard(text).then((copied) => {
    if (copied) toast.success("Copied to clipboard");
    else toast.error("Click back into the page before copying");
  });
}

export function buildCopilotInsights({
  customerSentiment,
  nudges,
  objections,
  unansweredQuestions,
  onAcceptNudge,
  onDismissNudge,
}: BuildCopilotInsightsInput): LiveInsightLine[] {
  const items: LiveInsightLine[] = [];

  if (customerSentiment) {
    items.push({
      id: `customer-intent-${customerSentiment.label}`,
      label: "Customer signal",
      kind: "insight",
      message: `Customer intent: ${customerSentiment.label}. ${customerSentiment.guidance}`,
      onDismiss: () => {},
    });
  }

  for (const n of nudges) {
    const isBantGap = n.source === "discovery-checklist";
    items.push({
      id: n.id,
      label: isBantGap ? "BANT gap" : "Live signal",
      kind: isBantGap ? "question" : "insight",
      message: n.message,
      details: isBantGap ? [n.message] : undefined,
      gotItLabel: "Got it",
      onGotIt: () => onAcceptNudge(n.id),
      onDismiss: () => onDismissNudge(n.id),
    });
  }

  for (const o of objections.slice(-3)) {
    items.push({
      id: `objection-${o.id ?? o.objection_text}`,
      label: "Objection",
      kind: "alert",
      message: o.objection_text,
      details: o.counter_points?.length ? o.counter_points : undefined,
      gotItLabel: "Flag deal",
      onGotIt: () => toast.message("Deal flagged for follow-up"),
      onDismiss: () => {},
    });
  }

  for (const q of unansweredQuestions.slice(-3)) {
    items.push({
      id: `question-${q.id ?? q.text}`,
      label: "Unanswered",
      kind: "question",
      message: q.text,
      details: [q.text],
      gotItLabel: "Copy",
      onGotIt: () => copyWithToast(q.text),
      onDismiss: () => {},
    });
  }

  return items;
}
