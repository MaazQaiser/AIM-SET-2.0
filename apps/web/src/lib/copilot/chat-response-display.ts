type ChatSurface =
  | "home"
  | "pre_dc"
  | "live_dc"
  | "post_dc"
  | "knowledge"
  | "content"
  | "agents"
  | "settings"
  | "global";

export function stripChatSourceFooters(content: string) {
  return content
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:\*\*)?sources?:\s*/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function copilotInputPlaceholder(surface: ChatSurface, fallback: string) {
  switch (surface) {
    case "home":
      return "Ask about priorities, missing briefs, or upcoming prep...";
    case "pre_dc":
      return "Ask for prep, BANT gaps, or an opening talk track...";
    case "live_dc":
      return "Ask for the next question, proof point, or talk track...";
    case "post_dc":
      return "Ask for next steps, client email edits, or Jira handoff...";
    case "knowledge":
      return "Ask to find proof points or compare knowledge assets...";
    case "content":
      return "Ask for content gaps, reusable slides, or draft ideas...";
    case "agents":
      return "Ask which agent to run or what needs review...";
    case "settings":
      return "Ask about setup, imports, or integration issues...";
    default:
      return fallback;
  }
}
