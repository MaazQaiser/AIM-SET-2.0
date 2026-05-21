export async function postSuggestionFeedback(
  callId: string,
  suggestionId: string,
  status: "accepted" | "dismissed"
): Promise<void> {
  await fetch(`/api/calls/${callId}/suggestions/${suggestionId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}
