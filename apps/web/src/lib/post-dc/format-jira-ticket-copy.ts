import type { PostCallJiraTicket } from "@/lib/brief-types";

export function formatJiraTicketForCopy(ticket: PostCallJiraTicket) {
  return [
    `Summary: ${ticket.summary}`,
    `Type: ${ticket.issueType}`,
    `Priority: ${ticket.priority}`,
    `Project: ${ticket.projectKey}`,
    "",
    ticket.description.trim(),
  ].join("\n");
}
