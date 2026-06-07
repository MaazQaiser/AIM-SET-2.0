"use client";

import { create } from "zustand";
import type { Call } from "@/types";
import type {
  CallBrief,
  PostCallAgentEnvelope,
  PostCallEmailDraft,
  PostCallEmailAttachments,
  PostCallJiraTicket,
  PostCallKbSuggestion,
  PostCallReview,
  PostCallTask,
} from "@/lib/brief-types";
import { buildCallsFromPreDc } from "@/lib/dc-data/build-calls-from-pre-dc";
import type { PostDCRecord, PreDCRecord } from "@/types/dc-notes";
import type { PostDcWorkflowTaskStatus } from "@/lib/post-dc/workflow-tasks";

interface DcImportsState {
  preDcRecords: PreDCRecord[];
  postDcRecords: PostDCRecord[];
  calls: Call[];
  briefsByCallId: Record<string, CallBrief>;
  postReviewsByCallId: Record<string, PostCallReview>;
  emailDraftsByCallId: Record<string, PostCallEmailDraft>;
  internalEmailDraftsByCallId: Record<string, PostCallEmailDraft>;
  crmTasksByCallId: Record<string, PostCallTask[]>;
  workflowTaskStatusByCallId: Record<string, Record<string, PostDcWorkflowTaskStatus>>;
  jiraTicketsByCallId: Record<string, PostCallJiraTicket>;
  postRunMetaByCallId: Record<
    string,
    {
      emailAttachments?: PostCallEmailAttachments;
      kbSuggestions?: PostCallKbSuggestion[];
      envelope?: PostCallAgentEnvelope;
      coaching?: Record<string, unknown>;
    }
  >;
  discoverySnapshotsByCallId: Record<string, { openGaps: string[]; bantCoverage?: number }>;
  setPostCallArtifacts: (
    callId: string,
    artifacts: {
      review?: PostCallReview;
      emailDraft?: PostCallEmailDraft;
      internalEmailDraft?: PostCallEmailDraft;
      crmTasks?: PostCallTask[];
      jiraTicket?: PostCallJiraTicket | null;
      emailAttachments?: PostCallEmailAttachments;
      kbSuggestions?: PostCallKbSuggestion[];
      envelope?: PostCallAgentEnvelope;
      coaching?: Record<string, unknown>;
      discoverySnapshot?: { openGaps: string[]; bantCoverage?: number };
      workflowTaskStatus?: Record<string, PostDcWorkflowTaskStatus>;
    }
  ) => void;
  setWorkflowTaskStatus: (
    callId: string,
    taskId: string,
    status: PostDcWorkflowTaskStatus
  ) => void;
  setDiscoverySnapshot: (callId: string, snapshot: { openGaps: string[]; bantCoverage?: number }) => void;
  preDcFileName: string | null;
  postDcFileName: string | null;
  importedAt: string | null;
  importVersion: number;
  /** True after the first loadFromDb attempt finishes (success or failure). */
  importsHydrated: boolean;
  loadFromDb: () => Promise<void>;
  clearImports: () => Promise<void>;
}

const emptyState = {
  preDcRecords: [] as PreDCRecord[],
  postDcRecords: [] as PostDCRecord[],
  calls: [] as Call[],
  briefsByCallId: {} as Record<string, CallBrief>,
  postReviewsByCallId: {} as Record<string, PostCallReview>,
  emailDraftsByCallId: {} as Record<string, PostCallEmailDraft>,
  internalEmailDraftsByCallId: {} as Record<string, PostCallEmailDraft>,
  crmTasksByCallId: {} as Record<string, PostCallTask[]>,
  workflowTaskStatusByCallId: {} as Record<string, Record<string, PostDcWorkflowTaskStatus>>,
  jiraTicketsByCallId: {} as Record<string, PostCallJiraTicket>,
  postRunMetaByCallId: {} as DcImportsState["postRunMetaByCallId"],
  discoverySnapshotsByCallId: {} as Record<string, { openGaps: string[]; bantCoverage?: number }>,
  preDcFileName: null as string | null,
  postDcFileName: null as string | null,
  importedAt: null as string | null,
  importVersion: 0,
  importsHydrated: false,
};

const LOAD_FROM_DB_TIMEOUT_MS = 8_000;

function applyBuilt(
  preDcRecords: PreDCRecord[],
  postDcRecords: PostDCRecord[],
  patch: Partial<DcImportsState> = {}
) {
  const built = buildCallsFromPreDc(preDcRecords, postDcRecords);
  return {
    preDcRecords,
    postDcRecords: built.postDcRecords,
    calls: built.calls,
    briefsByCallId: built.briefsByCallId,
    postReviewsByCallId: built.postReviewsByCallId,
    ...patch,
  };
}

export const useDcImportsStore = create<DcImportsState>()((set, get) => ({
  ...emptyState,
  setPostCallArtifacts: (callId, artifacts) =>
    set((s) => ({
      postReviewsByCallId: artifacts.review
        ? { ...s.postReviewsByCallId, [callId]: artifacts.review }
        : s.postReviewsByCallId,
      emailDraftsByCallId: artifacts.emailDraft
        ? { ...s.emailDraftsByCallId, [callId]: artifacts.emailDraft }
        : s.emailDraftsByCallId,
      internalEmailDraftsByCallId: artifacts.internalEmailDraft
        ? { ...s.internalEmailDraftsByCallId, [callId]: artifacts.internalEmailDraft }
        : s.internalEmailDraftsByCallId,
      crmTasksByCallId: artifacts.crmTasks
        ? { ...s.crmTasksByCallId, [callId]: artifacts.crmTasks }
        : s.crmTasksByCallId,
      jiraTicketsByCallId:
        artifacts.jiraTicket === undefined
          ? s.jiraTicketsByCallId
          : artifacts.jiraTicket
            ? { ...s.jiraTicketsByCallId, [callId]: artifacts.jiraTicket }
            : Object.fromEntries(Object.entries(s.jiraTicketsByCallId).filter(([id]) => id !== callId)),
      postRunMetaByCallId:
        artifacts.emailAttachments || artifacts.kbSuggestions || artifacts.envelope || artifacts.coaching
          ? {
              ...s.postRunMetaByCallId,
              [callId]: {
                ...(s.postRunMetaByCallId[callId] ?? {}),
                ...(artifacts.emailAttachments ? { emailAttachments: artifacts.emailAttachments } : {}),
                ...(artifacts.kbSuggestions ? { kbSuggestions: artifacts.kbSuggestions } : {}),
                ...(artifacts.envelope ? { envelope: artifacts.envelope } : {}),
                ...(artifacts.coaching ? { coaching: artifacts.coaching } : {}),
              },
            }
          : s.postRunMetaByCallId,
      discoverySnapshotsByCallId: artifacts.discoverySnapshot
        ? { ...s.discoverySnapshotsByCallId, [callId]: artifacts.discoverySnapshot }
        : s.discoverySnapshotsByCallId,
      workflowTaskStatusByCallId: artifacts.workflowTaskStatus
        ? {
            ...s.workflowTaskStatusByCallId,
            [callId]: {
              ...(s.workflowTaskStatusByCallId[callId] ?? {}),
              ...artifacts.workflowTaskStatus,
            },
          }
        : s.workflowTaskStatusByCallId,
    })),
  setWorkflowTaskStatus: (callId, taskId, status) =>
    set((s) => ({
      workflowTaskStatusByCallId: {
        ...s.workflowTaskStatusByCallId,
        [callId]: {
          ...(s.workflowTaskStatusByCallId[callId] ?? {}),
          [taskId]: status,
        },
      },
    })),
  setDiscoverySnapshot: (callId, snapshot) =>
    set((s) => ({
      discoverySnapshotsByCallId: { ...s.discoverySnapshotsByCallId, [callId]: snapshot },
    })),
  loadFromDb: async () => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), LOAD_FROM_DB_TIMEOUT_MS);
    try {
      const res = await fetch("/api/dc-notes", { signal: controller.signal });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { detail?: string; error?: string } | null;
        throw new Error(err?.detail ?? err?.error ?? `Failed to load DC notes (${res.status})`);
      }

      const data = (await res.json()) as {
        pre_dc_records?: PreDCRecord[];
        post_dc_records?: PostDCRecord[];
      };

      const preDcRecords = data.pre_dc_records ?? [];
      const postDcRecords = data.post_dc_records ?? [];
      const state = get();

      set({
        ...applyBuilt(preDcRecords, postDcRecords),
        importedAt: preDcRecords.length || postDcRecords.length ? new Date().toISOString() : null,
        importVersion: state.importVersion + 1,
        importsHydrated: true,
      });
    } catch (error) {
      set({ importsHydrated: true });
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Loading DC notes timed out. The dashboard will keep using local demo data.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  },
  clearImports: async () => {
    set({ ...emptyState, importVersion: get().importVersion + 1, importsHydrated: true });
  },
}));
