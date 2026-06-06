import type { DemoTranscriptLine } from "@/lib/demo-live-transcript";
import { postDcField } from "@/types/dc-notes";
import type { PostDCRecord } from "@/types/dc-notes";
import type { TranscriptEvent } from "@/types";

const BUDGET_LINES: Record<string, string> = {
  Yes: "Budget is approved for the scope we discussed — we can move on a signed SOW.",
  "100K+": "We have north of a hundred thousand earmarked for this initiative.",
  "50-100K": "Phase one budget is in the fifty to one hundred thousand range and funded.",
  "10-50K": "We can approve roughly ten to fifty thousand for an initial phase.",
  "Less than 10K": "Budget is tight — under ten thousand unless we split into a smaller pilot.",
  Partial: "Budget direction is there, but final sign-off still needs CFO or board review.",
  No: "We do not have software budget approved yet — timing depends on other priorities.",
};

const AUTHORITY_LINES: Record<string, string> = {
  Yes: "I can sponsor this internally and bring the economic buyer into the next session.",
  Partial: "I am a strong champion, but finance or the board still has to approve spend.",
  No: "I am not the final decision maker — we will need my leadership team in the loop.",
};

const TIMELINE_LINES: Record<string, string> = {
  "Less than 30 days": "We need to decide and kick off within the next thirty days.",
  "30-60 days": "Realistically we are targeting a decision in the next thirty to sixty days.",
  "60+ days": "This is a longer cycle — sixty days or more before we can commit.",
};

function extractParties(bottomLine: string): { lead: string; company: string } {
  const match = bottomLine.match(
    /^(.+?) at (.+?) (?:confirmed|needs|is scoping|wants|validated|highlighted|described|acknowledged|see value|is exploring|is consolidating|is interested|stated|asked)/i
  );
  if (match) {
    return { lead: match[1].trim(), company: match[2].trim() };
  }
  return { lead: "Customer", company: "the account" };
}

function budgetLine(value: string): string {
  const key = value.trim();
  return BUDGET_LINES[key] ?? (key ? `On budget: ${key}.` : BUDGET_LINES.Partial);
}

function authorityLine(value: string): string {
  const key = value.trim();
  return AUTHORITY_LINES[key] ?? (key ? `On authority: ${key}.` : AUTHORITY_LINES.Partial);
}

function timelineLine(value: string): string {
  const key = value.trim();
  return TIMELINE_LINES[key] ?? (key ? `Timeline: ${key}.` : TIMELINE_LINES["30-60 days"]);
}

function nextStepLines(strategy: string): string[] {
  const cleaned = strategy.trim();
  if (!cleaned) return ["Let's regroup next week with a written follow-up plan."];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export function buildPostDcDemoTranscript(
  callId: string,
  record: PostDCRecord
): DemoTranscriptLine[] {
  const bottomLine = postDcField(record, "bottomLineContext");
  const { lead, company } = extractParties(bottomLine);
  const need = postDcField(record, "need") || bottomLine;
  const budget = postDcField(record, "budget");
  const authority = postDcField(record, "authority");
  const timeline = postDcField(record, "timeline");
  const strategy = postDcField(record, "salesStrategy");
  const steps = nextStepLines(strategy);

  const lines: DemoTranscriptLine[] = [
    {
      text: `Thanks for joining today — goal is to confirm pain, budget, and what happens after this call for ${company}.`,
      speakerId: "ae-host",
      speakerName: "Saad",
      speakerRole: "ae",
      offsetSeconds: 8,
      pauseAfterMs: 1800,
    },
    {
      text: bottomLine || `We need a unified platform — our current tools are breaking at scale for ${company}.`,
      speakerId: "customer-lead",
      speakerName: lead,
      speakerRole: "customer",
      offsetSeconds: 28,
      pauseAfterMs: 2200,
    },
    {
      text: need,
      speakerId: "customer-lead",
      speakerName: lead,
      speakerRole: "customer",
      offsetSeconds: 52,
      pauseAfterMs: 2000,
    },
    {
      text: "Help me understand budget — is phase one funded or still pending approval?",
      speakerId: "ae-host",
      speakerName: "Saad",
      speakerRole: "ae",
      offsetSeconds: 78,
      pauseAfterMs: 1600,
    },
    {
      text: budgetLine(budget),
      speakerId: "customer-lead",
      speakerName: lead,
      speakerRole: "customer",
      offsetSeconds: 96,
      pauseAfterMs: 2000,
    },
    {
      text: "Who else needs to be in the room before you can sign — CFO, board, or IT leadership?",
      speakerId: "ae-host",
      speakerName: "Saad",
      speakerRole: "ae",
      offsetSeconds: 118,
      pauseAfterMs: 1600,
    },
    {
      text: authorityLine(authority),
      speakerId: "customer-lead",
      speakerName: lead,
      speakerRole: "customer",
      offsetSeconds: 136,
      pauseAfterMs: 2000,
    },
    {
      text: "From a delivery standpoint we can phase this — discovery first, then a fixed MVP scope once interfaces are validated.",
      speakerId: "se-lead",
      speakerName: "Shoaib",
      speakerRole: "se",
      offsetSeconds: 158,
      pauseAfterMs: 1800,
    },
    {
      text: timelineLine(timeline),
      speakerId: "customer-lead",
      speakerName: lead,
      speakerRole: "customer",
      offsetSeconds: 182,
      pauseAfterMs: 2000,
    },
    {
      text: `Recapping next steps: ${steps[0]}`,
      speakerId: "ae-host",
      speakerName: "Saad",
      speakerRole: "ae",
      offsetSeconds: 208,
      pauseAfterMs: 1800,
    },
  ];

  if (steps[1]) {
    lines.push({
      text: steps[1],
      speakerId: "ae-host",
      speakerName: "Saad",
      speakerRole: "ae",
      offsetSeconds: 228,
      pauseAfterMs: 1600,
    });
  }

  lines.push({
    text: "That works — please send the follow-up materials and we'll confirm owners on our side.",
    speakerId: "customer-lead",
    speakerName: lead,
    speakerRole: "customer",
    offsetSeconds: 248,
    pauseAfterMs: 1200,
  });

  return lines;
}

export function transcriptEventsFromPostDcDemo(
  callId: string,
  record: PostDCRecord
): TranscriptEvent[] {
  const baseTime = Date.now() - 45 * 60_000;
  return buildPostDcDemoTranscript(callId, record).map((line, index) => ({
    id: `${callId}-post-dc-t-${index}`,
    speakerId: line.speakerId,
    speakerName: line.speakerName,
    speakerRole: line.speakerRole,
    text: line.text,
    timestamp: baseTime + line.offsetSeconds * 1000,
    sentiment:
      line.speakerRole === "customer" && /approved|works|confirmed|targeting/i.test(line.text)
        ? "positive"
        : "neutral",
  }));
}

export function getPostDcTranscriptForCall(
  callId: string,
  record: PostDCRecord | undefined | null
): TranscriptEvent[] {
  if (!record) return [];
  return transcriptEventsFromPostDcDemo(callId, record);
}
