import type { CustomerSentimentCue, SentimentShift } from "@/types";

export interface InstantSentimentResult {
  score: number;
  cue: CustomerSentimentCue;
  shift?: SentimentShift;
}

const ANGRY_PATTERNS =
  /\b(?:another vendor|look for another|find someone else|waste (?:of |my )?time|not impressed|misunderstood|frustrated|furious|angry|unacceptable|ridiculous|terrible|horrible|awful|disgusted|fed up|done with|give up|walk away|cancel|not interested anymore|losing patience|lost patience|disappointed|disrespectful|incompetent|useless|pointless|no confidence|lack of confidence|not confident|don't trust|do not trust|never again|worst|rip[\s-]*off|scam)\b/i;

const FRUSTRATION_PATTERNS =
  /\b(?:i(?:'m| am) repeating|already (?:told|said|mentioned|explained|asked)|how many times|again and again|over and over|keep (?:asking|saying|repeating|telling)|same (?:thing|question)|listen to me|are you listening|pay attention|not listening|didn't hear|did not hear|i just said|as i (?:said|mentioned|told)|third time|fourth time|multiple times|once again|yet again|for the (?:last|third|fourth) time)\b/i;

const THREAT_PATTERNS =
  /\b(?:escalate|speak to (?:your |a )?(?:manager|supervisor|senior|boss|leadership)|bring (?:someone|somebody) (?:senior|else)|senior salesperson|complain|formal complaint|legal|lawyer|contract (?:says|states)|breach|sue|report you|bad review|negative review)\b/i;

const NEGATIVE_EMOTION_PATTERNS =
  /\b(?:nightmare|bottleneck|broken|chaotic|scattered|zero visibility|no visibility|pain point|struggling|can't believe|cannot believe|shocked|appalled|outraged|insulting|offensive|rude|condescending|patronizing|don't care|do not care|doesn't matter|does not matter|forget it|never mind|whatever)\b/i;

const POSITIVE_RECOVERY_PATTERNS =
  /\b(?:that(?:'s| is) (?:exactly|great|perfect|helpful|useful|better|good|fair)|appreciate|thank you|makes sense|move forward|confident now|on the right track|impressed|excellent|wonderful|love (?:it|that|this)|first answer today|specific|practical|constructive)\b/i;

function detectFrustrationIntensity(text: string): number {
  let intensity = 0;

  if (ANGRY_PATTERNS.test(text)) intensity += 0.4;
  if (FRUSTRATION_PATTERNS.test(text)) intensity += 0.3;
  if (THREAT_PATTERNS.test(text)) intensity += 0.35;
  if (NEGATIVE_EMOTION_PATTERNS.test(text)) intensity += 0.2;

  // Exclamation marks and ALL CAPS amplify
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= 2) intensity += 0.1;

  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  if (capsWords >= 2) intensity += 0.1;

  return Math.min(intensity, 1.0);
}

function detectPositiveRecovery(text: string): boolean {
  return POSITIVE_RECOVERY_PATTERNS.test(text);
}

function cueFromIntensity(intensity: number): CustomerSentimentCue {
  if (intensity >= 0.6) {
    return {
      label: "Frustrated buyer",
      guidance: "Stop pitching. Acknowledge the frustration directly, then ask what needs to change.",
      tone: "negative",
      source: "instant-detect",
    };
  }
  if (intensity >= 0.3) {
    return {
      label: "Decision risk",
      guidance: "Acknowledge the concern, ask what is at risk, then address that issue.",
      tone: "negative",
      source: "instant-detect",
    };
  }
  return {
    label: "Pain exposed",
    guidance: "Mirror the buyer's words, then ask one concise follow-up.",
    tone: "negative",
    source: "instant-detect",
  };
}

export function detectInstantSentiment(
  text: string,
  speakerRole: string | undefined,
  timestamp: number,
  previousScore: number | null
): InstantSentimentResult | null {
  if (speakerRole !== "customer") return null;
  if (!text || text.length < 10) return null;

  const frustration = detectFrustrationIntensity(text);
  const positive = detectPositiveRecovery(text);

  // Positive recovery
  if (positive && frustration < 0.2) {
    const score = 0.5;
    const cue: CustomerSentimentCue = {
      label: "Buying confidence",
      guidance: "Confirm what is working, then lock decision criteria and next step.",
      tone: "positive",
      source: "instant-detect",
    };
    const shift: SentimentShift | undefined =
      previousScore != null && previousScore < 0
        ? {
            direction: "positive",
            from_score: previousScore,
            to_score: score,
            timestamp,
            message: "Customer sentiment is warming after the latest response.",
          }
        : undefined;
    return { score, cue, shift };
  }

  // Negative / frustrated
  if (frustration >= 0.2) {
    const score = -(0.3 + frustration * 0.5);
    const cue = cueFromIntensity(frustration);
    const shift: SentimentShift | undefined =
      previousScore == null || previousScore > score + 0.15
        ? {
            direction: "negative",
            from_score: previousScore ?? 0,
            to_score: score,
            timestamp,
            message:
              frustration >= 0.6
                ? "Customer is frustrated — stop pitching and recover trust."
                : "Customer sentiment shifted toward negative — check engagement.",
          }
        : undefined;
    return { score, cue, shift };
  }

  return null;
}
