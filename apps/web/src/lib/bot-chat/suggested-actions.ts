import type { CallBrief } from "@/lib/brief-types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";
import type { PodRole } from "@/types";
import type { BotChatPhase, SuggestedAction } from "@/lib/bot-chat/types";

export interface SuggestedActionsContext {
  phase: BotChatPhase;
  persona: PodRole | "leadership";
  accountName?: string;
  brief?: CallBrief | null;
  intentLabel?: string;
  painCount?: number;
  openGaps?: string[];
  bantCoveragePct?: number;
  transcriptLineCount?: number;
  hasObjections?: boolean;
}

const ROLE_PREP: Record<string, SuggestedAction[]> = {
  ae: [
    {
      id: "prep-opening",
      label: "Opening script",
      prompt:
        "Draft a 30-second opening for this discovery call that anchors on the top hypothesized pain and asks for permission to explore BANT.",
      category: "prepare",
    },
    {
      id: "prep-bant-gaps",
      label: "BANT gaps to probe",
      prompt:
        "List the BANT gaps we should prioritize on this call and give me exact questions to ask for each gap.",
      category: "prepare",
    },
    {
      id: "prep-objections",
      label: "Objection prep",
      prompt:
        "What objections are likely based on the brief, and how should I handle each with evidence from our knowledge base?",
      category: "prepare",
    },
    {
      id: "prep-competitive",
      label: "Competitive angle",
      prompt:
        "If the prospect mentions build-vs-buy or an incumbent vendor, what positioning should I use?",
      category: "prepare",
    },
  ],
  se: [
    {
      id: "prep-arch",
      label: "Architecture talking points",
      prompt:
        "Summarize the technical talking points I should be ready to explain for this account's stack and pains.",
      category: "prepare",
    },
    {
      id: "prep-integrations",
      label: "Integration risks",
      prompt:
        "What integration or data risks should I listen for on this call based on the brief?",
      category: "prepare",
    },
    {
      id: "prep-deep-dive",
      label: "When to go deep",
      prompt:
        "When should I offer a technical deep-dive vs stay high-level on this discovery call?",
      category: "prepare",
    },
  ],
  designer: [
    {
      id: "prep-ux",
      label: "UX discovery prompts",
      prompt:
        "Suggest discovery questions about user workflows and design constraints for this prospect.",
      category: "prepare",
    },
  ],
};

const LIVE_COMMON: SuggestedAction[] = [
  {
    id: "live-summary",
    label: "Running summary",
    prompt:
      "Give the pod a concise running summary of the call so far: intent, pains, BANT status, and what to do next.",
    category: "live",
  },
  {
    id: "live-next-question",
    label: "Next best question",
    prompt:
      "Based on the transcript and discovery gaps, what is the single best question I should ask next?",
    category: "live",
  },
  {
    id: "live-kb",
    label: "KB asset to show",
    prompt:
      "Which knowledge-base asset or case study best fits what the customer just said, and how should I introduce it?",
    category: "live",
  },
  {
    id: "live-objection",
    label: "Handle objection",
    prompt:
      "If there was a recent objection or concern in the transcript, suggest a concise response with proof points.",
    category: "live",
  },
];

export function buildSuggestedActions(ctx: SuggestedActionsContext): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const role = ctx.persona === "leadership" ? "ae" : ctx.persona;

  if (ctx.phase === "prep") {
    actions.push(...(ROLE_PREP[role] ?? ROLE_PREP.ae));
    if (ctx.brief?.pains?.length) {
      actions.push({
        id: "prep-pain-bridge",
        label: "Bridge top pain",
        prompt: `How do I bridge from rapport into the top pain (${ctx.brief.pains[0]?.text?.slice(0, 80) ?? "from brief"}) without sounding scripted?`,
        category: "prepare",
      });
    }
    if (ctx.brief?.aiSummary) {
      actions.push({
        id: "prep-exec-summary",
        label: "Exec summary",
        prompt: "Turn the pre-call brief into five bullet talking points for the pod huddle before we join.",
        category: "prepare",
      });
    }
    return actions.slice(0, 6);
  }

  actions.push(...LIVE_COMMON);

  if (ctx.openGaps?.includes("authority")) {
    actions.push({
      id: "live-authority",
      label: "Surface economic buyer",
      prompt:
        "Suggest how to surface the CFO or economic buyer without derailing the current thread.",
      category: "live",
    });
  }
  if (ctx.openGaps?.includes("budget")) {
    actions.push({
      id: "live-budget",
      label: "Budget clarification",
      prompt:
        "The budget gap is still open — give me two ways to clarify budget and board timing based on what's been said.",
      category: "live",
    });
  }
  if ((ctx.painCount ?? 0) >= 2) {
    actions.push({
      id: "live-proposal-path",
      label: "Proposal path",
      prompt:
        "The prospect may be heading toward a proposal — what scope, timeline, and proof should we confirm before committing?",
      category: "follow-up",
    });
  }
  if (ctx.intentLabel?.includes("commercial") || ctx.intentLabel?.includes("proposal")) {
    actions.push({
      id: "live-commercial",
      label: "Commercial next step",
      prompt:
        "Given commercial discovery intent, what should we agree on before ending the call (proposal outline, pilot, readout)?",
      category: "live",
    });
  }
  if (role === "se" && (ctx.transcriptLineCount ?? 0) > 5) {
    actions.push({
      id: "live-tech-defer",
      label: "Technical deferral",
      prompt:
        "Should we defer any technical depth to a follow-up session? Recommend what to park vs answer now.",
      category: "live",
    });
  }

  return actions.slice(0, 6);
}

export function checklistBantPct(checklist: DiscoveryChecklistState | null): number | undefined {
  if (!checklist) return undefined;
  return Math.round(checklist.bantCoverage * 100);
}
