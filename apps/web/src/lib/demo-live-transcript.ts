import {
  FRANCHISE_DEMO_CALL_ID,
  FRANCHISE_DEMO_TRANSCRIPT,
} from "@/lib/demo/franchise-ai-platform-demo";

/** Scripted DC call lines for local live-cockpit testing without Recall. */

export interface DemoTranscriptLine {
  text: string;
  speakerId: string;
  speakerName: string;
  speakerRole: "customer" | "ae" | "se" | "designer";
  /** Seconds from call start */
  offsetSeconds: number;
  /** Pause after this line before the next (ms) */
  pauseAfterMs?: number;
}

/** Default demo playback (Frontera franchise AI platform scenario). */
export const DEMO_LIVE_TRANSCRIPT: DemoTranscriptLine[] = FRANCHISE_DEMO_TRANSCRIPT;

/** @deprecated Use DEMO_LIVE_TRANSCRIPT or getDemoTranscriptForCall */
export const LEGACY_MERIDIAN_TRANSCRIPT: DemoTranscriptLine[] = [
  {
    text: "Thanks for making time today — I'll keep intros brief.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 5,
    pauseAfterMs: 2000,
  },
  {
    text: "Happy to be here. We filed an updated Form ADV last week — the ESG mandate expansion is driving a lot of urgency.",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 25,
    pauseAfterMs: 2500,
  },
  {
    text: "That's helpful — can you say more about how ESG reporting is breaking your current setup?",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 45,
    pauseAfterMs: 2000,
  },
  {
    text: "Honestly the continuous compliance requirements will break our stack within a year if we don't modernize.",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 60,
    pauseAfterMs: 2000,
  },
  {
    text: "We're probably looking at Q3 to bring this to the board, but boards are unpredictable on budget.",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 90,
    pauseAfterMs: 3000,
  },
  {
    text: "We're also evaluating Salesforce — they've been in the mix for six months.",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 95,
    pauseAfterMs: 2500,
  },
  {
    text: "What would have to be true for the board to say yes — regulatory proof, phased cost, references?",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 100,
    pauseAfterMs: 2000,
  },
  {
    text: "Regulatory liability quantified, phased investment plan, and at least one 18-month customer reference.",
    speakerId: "ae-sarah",
    speakerName: "Sarah",
    speakerRole: "ae",
    offsetSeconds: 115,
    pauseAfterMs: 2500,
  },
  {
    text: "How do you handle intraday position reconciliation across multiple custodians?",
    speakerId: "eleanor",
    speakerName: "Eleanor",
    speakerRole: "customer",
    offsetSeconds: 140,
    pauseAfterMs: 3500,
  },
  {
    text: "We use a standard reconciliation pattern — let me pull the right reference architecture.",
    speakerId: "se-tariq",
    speakerName: "Tariq",
    speakerRole: "se",
    offsetSeconds: 145,
    pauseAfterMs: 2000,
  },
  {
    text: "We did this for a Boston hedge fund — split custody feeds into one intraday ledger with exception workflows.",
    speakerId: "se-tariq",
    speakerName: "Tariq",
    speakerRole: "se",
    offsetSeconds: 155,
    pauseAfterMs: 1500,
  },
];

export function getDemoTranscriptForCall(callId: string): DemoTranscriptLine[] {
  if (callId === FRANCHISE_DEMO_CALL_ID) return FRANCHISE_DEMO_TRANSCRIPT;
  return DEMO_LIVE_TRANSCRIPT;
}

export { FRANCHISE_DEMO_CALL_ID };
