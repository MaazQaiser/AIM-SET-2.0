export type CopilotGreetingSurface =
  | "home"
  | "pre_dc"
  | "live_dc"
  | "post_dc"
  | "knowledge"
  | "content"
  | "agents"
  | "settings"
  | "global";

export interface SimpleGreetingResponse {
  content: string;
  message_id: string;
  citations: [];
  actions_taken: [];
  call_exports: [];
  suggestions: string[];
  confidence: number;
  missing_evidence: [];
}

const GREETING_PATTERNS = new Set([
  "gm",
  "good afternoon",
  "good evening",
  "good morning",
  "hello",
  "hello there",
  "hey",
  "hey there",
  "hi",
  "hi there",
  "hii",
  "yo",
]);

function normalizedGreeting(message: string) {
  return message
    .trim()
    .toLowerCase()
    .replace(/[!?.。,،;:]+$/g, "")
    .replace(/\s+/g, " ");
}

export function isSimpleGreeting(message: string) {
  const normalized = normalizedGreeting(message);
  return GREETING_PATTERNS.has(normalized);
}

function suggestionsForSurface(surface: CopilotGreetingSurface) {
  switch (surface) {
    case "live_dc":
      return ["Next best question", "Call summary", "Objection response"];
    case "pre_dc":
      return ["Prep this call", "BANT gaps", "Proof points"];
    case "post_dc":
      return ["Client email", "Open risks", "Next steps"];
    case "knowledge":
      return ["Search knowledge base", "Best case study", "Compare assets"];
    case "content":
      return ["Content gaps", "Draft asset", "Proof points"];
    case "agents":
      return ["Agent status", "Recent runs", "Run briefing"];
    case "settings":
      return ["Import status", "Agent settings", "Data sources"];
    case "home":
    case "global":
    default:
      return ["Today's priorities", "Missing briefs", "Upcoming prep"];
  }
}

function contentForSurface(surface: CopilotGreetingSurface) {
  switch (surface) {
    case "live_dc":
      return "Hi. What can I help you with on this call?";
    case "pre_dc":
      return "Hi. What can I help you prepare?";
    case "post_dc":
      return "Hi. What can I help you wrap up?";
    default:
      return "Hi. What can I help you with?";
  }
}

export function buildSimpleGreetingResponse(
  message: string,
  surface: CopilotGreetingSurface = "global"
): SimpleGreetingResponse | null {
  if (!isSimpleGreeting(message)) return null;

  return {
    content: contentForSurface(surface),
    message_id: `greeting-${Date.now()}`,
    citations: [],
    actions_taken: [],
    call_exports: [],
    suggestions: suggestionsForSurface(surface),
    confidence: 1,
    missing_evidence: [],
  };
}
