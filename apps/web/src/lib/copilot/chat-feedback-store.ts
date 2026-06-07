export type CopilotFeedbackRating = "up" | "down";

export interface StoredCopilotFeedback {
  id: string;
  messageId: string;
  rating: CopilotFeedbackRating;
  comment: string;
  response: string;
  surface?: string;
  callId?: string | null;
  createdAt: number;
  synced: boolean;
}

export interface CopilotFeedbackInput {
  messageId: string;
  rating: CopilotFeedbackRating;
  comment: string;
  response: string;
  surface?: string;
  callId?: string | null;
}

const STORAGE_KEY = "dc-copilot:chat-feedback";
const MAX_STORED_FEEDBACK = 200;

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function makeFeedbackId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseFeedback(raw: string | null): StoredCopilotFeedback[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is StoredCopilotFeedback => {
      return (
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.messageId === "string" &&
        (item.rating === "up" || item.rating === "down")
      );
    });
  } catch {
    return [];
  }
}

export function listStoredCopilotFeedback() {
  const storage = getBrowserStorage();
  if (!storage) return [];
  return parseFeedback(storage.getItem(STORAGE_KEY));
}

function upsertStoredFeedback(record: StoredCopilotFeedback) {
  const storage = getBrowserStorage();
  if (!storage) return;
  const existing = listStoredCopilotFeedback().filter((item) => item.id !== record.id);
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify([record, ...existing].slice(0, MAX_STORED_FEEDBACK))
  );
}

export async function saveCopilotFeedback(input: CopilotFeedbackInput) {
  const record: StoredCopilotFeedback = {
    ...input,
    id: makeFeedbackId(),
    createdAt: Date.now(),
    synced: false,
  };

  upsertStoredFeedback(record);

  try {
    const res = await fetch("/api/copilot/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feedback_id: record.id,
        message_id: record.messageId,
        rating: record.rating,
        comment: record.comment,
        response: record.response,
        surface: record.surface,
        call_id: record.callId,
        created_at: new Date(record.createdAt).toISOString(),
      }),
    });

    if (!res.ok) {
      return record;
    }

    const synced = { ...record, synced: true };
    upsertStoredFeedback(synced);
    return synced;
  } catch {
    return record;
  }
}
