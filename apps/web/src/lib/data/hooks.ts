"use client";

import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { bffFetch } from "@/lib/api/bff-fetch";
import { buildArtifactStudioHref } from "@/lib/content-studio/artifact-studio-href";
import { groupPreDcGaps } from "@/lib/content/group-pre-dc-gaps";
import { groupPostDcGaps } from "@/lib/content/group-post-dc-gaps";
import { QUERY_STALE_TIME_MS } from "@/lib/data/query-cache";
import type {
  Call,
  CoachingInsight,
  ContentGap,
  CoachingCandidate,
  KbWatchlistItem,
  KBAsset,
  KBProject,
  QuarterlyPattern,
  TranscriptEvent,
} from "@/types";
import { normalizeSummarySections } from "@dc-copilot/types/brief";
import type {
  CallBrief,
  ContentToGenerate,
  RelevantDocument,
  RelevantProject,
  PostCallEmailAttachmentMissing,
  PostCallEmailDraft,
  PostCallJiraTicket,
  PostCallPipelineResult,
  PostCallReview,
} from "@/lib/brief-types";
import {
  FRANCHISE_DEMO_CALL_ID,
  franchiseDemoPostCallArtifacts,
  franchiseDemoPostReview,
  mergeFranchiseDemoCalls,
} from "@/lib/demo/franchise-ai-platform-demo";
import { mergeCallsWithImport } from "@/lib/dc-data/merge-calls-with-import";
import { getPostDcTranscriptForCall } from "@/lib/demo/build-post-dc-transcript";
import {
  getImportVersion,
  resolveCallStatusOverrides,
  resolveCall,
  resolveCallBrief,
  resolveCalls,
  resolveFranchiseDemoCallForList,
  resolvePostCallReview,
  resolvePostDcRecordForCall,
} from "@/lib/dc-data/resolvers";
import { hasClientUnsafeEmailText, sanitizeClientEmailDraft } from "@/lib/post-dc-client-email-safety";
import type { TaskItem } from "@/components/post-dc/crm-task-list";
import type { ActivityEvent, AgentRun } from "@/types/agents";
import type { PlannedArtifactType } from "@dc-copilot/types/brief";
import { mapPostDcGapType } from "@/lib/content/group-post-dc-gaps";

const BRIEF_POLL_MS = 8_000;
const KB_ASSETS_SNAPSHOT_KEY = "dc-copilot:kb-assets:v1";
const KB_ASSETS_SNAPSHOT_MAX_AGE_MS = 5 * 60 * 1000;

function readKbAssetsSnapshot(): KBAsset[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(KB_ASSETS_SNAPSHOT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { savedAt?: number; assets?: unknown };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > KB_ASSETS_SNAPSHOT_MAX_AGE_MS) {
      window.localStorage.removeItem(KB_ASSETS_SNAPSHOT_KEY);
      return undefined;
    }
    return Array.isArray(parsed.assets) ? (parsed.assets as KBAsset[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeKbAssetsSnapshot(assets: KBAsset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KB_ASSETS_SNAPSHOT_KEY,
      JSON.stringify({ savedAt: Date.now(), assets })
    );
  } catch {
    // Ignore storage quota/private-mode failures; React Query still owns live data.
  }
}

export interface PreDcContentGenerationGap extends ContentToGenerate {
  callId: string;
  accountName: string;
  leadName?: string;
  leadTitle?: string;
  industry?: string;
  scheduledAt?: string;
  sourceItemId?: string;
  sourcePath?: string;
  contentRequirements?: string;
  context?: Record<string, unknown>;
  studioHref: string;
}

export interface PostDcContentGenerationGap {
  id: string;
  callId: string;
  accountName: string;
  leadName?: string;
  leadTitle?: string;
  industry?: string;
  scheduledAt?: string;
  name: string;
  type: PlannedArtifactType;
  priority: number;
  status: "missing";
  reason: string;
  neededFor: string;
  sourcePath?: string;
  contentRequirements?: string;
  context?: Record<string, unknown>;
  studioHref: string;
}

function formatPostDcMissingReason(requiredData: string): string {
  const text = requiredData.trim();
  if (!text) return "Suggested from discovery gaps on this call.";

  const evidenceMatch = text.match(/Transcript evidence:\s*(.+)/i);
  if (evidenceMatch?.[1]) return evidenceMatch[1].trim();

  const createMatch = text.match(/Create or find:\s*(.+)/i);
  if (createMatch?.[1]) return createMatch[1].replace(/\.\s*Transcript evidence:.*$/i, "").trim();

  return text;
}

function withEmailAttachments(
  draft: PostCallEmailDraft | undefined,
  attachments: PostCallPipelineResult["emailAttachments"]
) {
  return draft
    ? {
        ...draft,
        attachments: draft.attachments ?? attachments,
      }
    : undefined;
}

function buildInternalEmailFallback(
  callId: string,
  api: PostCallPipelineResult
): PostCallEmailDraft | undefined {
  const taskList = api.task?.taskList ?? api.task?.crmTasks ?? [];
  if (!api.review && taskList.length === 0) return undefined;
  const accountName = api.accountName ?? callId;
  const bantScore =
    typeof api.review?.discoveryBantCoverage === "number"
      ? `${Math.round(api.review.discoveryBantCoverage * 100)}%`
      : "Needs review";
  const gaps = api.review?.openDiscoveryGaps ?? [];
  const taskLines = taskList.length
    ? taskList.slice(0, 8).map((task) => `- [${task.owner || "Pod"}] ${task.description}`)
    : ["- Review the post-call summary and assign next action owners."];
  const summaryLines = (api.review?.summary ?? []).slice(0, 4).map((item) => `- ${item}`);

  return {
    id: `internal-email-${callId}`,
    audience: "internal",
    to: ["internal-team@dc-copilot.local"],
    cc: [],
    subject: `Internal Post-DC action plan: ${accountName}`,
    body_markdown: [
      `Internal Post-DC summary for ${accountName}`,
      "",
      `BANT score: ${bantScore}`,
      gaps.length ? `Open BANT gaps: ${gaps.join(", ")}` : "BANT gaps: none currently flagged",
      "",
      "Call summary:",
      ...(summaryLines.length ? summaryLines : ["- Review generated Post-DC summary before sharing externally."]),
      "",
      "Next action items:",
      ...taskLines,
    ].join("\n"),
    style_signals: ["internal", "action-oriented", "bant-focused"],
    commitments_referenced: taskList
      .slice(0, 6)
      .map((task) => task.description)
      .filter(Boolean),
    status: "draft_pending_approval",
  };
}

async function fetchCallsFromApi(): Promise<Call[]> {
  const imported = resolveCalls();
  const statusOverrides = resolveCallStatusOverrides();
  const demoCall = resolveFranchiseDemoCallForList();
  const api = await bffFetch<Call[]>("/api/calls");
  if (api && api.length > 0) {
    return mergeFranchiseDemoCalls(mergeCallsWithImport(api, imported, statusOverrides), demoCall);
  }
  return mergeFranchiseDemoCalls(imported, demoCall);
}

export function useCalls() {
  const localCalls = mergeFranchiseDemoCalls(resolveCalls(), resolveFranchiseDemoCallForList());
  return useQuery({
    queryKey: ["calls", getImportVersion()],
    queryFn: fetchCallsFromApi,
    placeholderData: localCalls.length > 0 ? localCalls : undefined,
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useCall(callId: string) {
  const localCall = resolveCall(callId);
  return useQuery({
    queryKey: ["call", callId, getImportVersion()],
    queryFn: async () => {
      const local = resolveCall(callId);
      const api = await bffFetch<Call>(`/api/calls/${callId}`);
      if (api && local) {
        return mergeCallsWithImport([api], [local], resolveCallStatusOverrides())[0] ?? api;
      }
      if (api) return api;
      if (local) return local;
      throw new Error(`Call not found: ${callId}`);
    },
    placeholderData: localCall,
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useCallTranscript(callId: string) {
  return useQuery<TranscriptEvent[]>({
    queryKey: ["call-transcript", callId, getImportVersion()],
    queryFn: async () => {
      const res = await bffFetch<{ events?: TranscriptEvent[] }>(
        `/api/calls/${callId}/live-session`
      );
      const apiEvents = res?.events ?? [];
      if (apiEvents.length > 0) return apiEvents;

      const postDcRecord = resolvePostDcRecordForCall(callId);
      return getPostDcTranscriptForCall(callId, postDcRecord);
    },
    staleTime: QUERY_STALE_TIME_MS,
    enabled: Boolean(callId),
  });
}

function mergeCallBrief(local: CallBrief, api: CallBrief): CallBrief {
  const summarySections = normalizeSummarySections(
    api.summarySections?.length ? api.summarySections : local.summarySections
  );
  return {
    ...local,
    ...api,
    callId: local.callId,
    accountName: api.accountName || local.accountName,
    summarySections,
    newSignals: api.newSignals?.length ? api.newSignals : local.newSignals,
    pains: api.pains?.length ? api.pains : local.pains,
    objections: api.objections?.length ? api.objections : local.objections,
    researchSections: api.researchSections?.length
      ? api.researchSections
      : local.researchSections,
    preDeck: api.preDeck ?? local.preDeck,
    artifactPlan: api.artifactPlan?.length ? api.artifactPlan : local.artifactPlan,
    artifactFulfillment: api.artifactFulfillment?.length
      ? api.artifactFulfillment
      : local.artifactFulfillment,
    contentToGenerate: api.contentToGenerate?.length
      ? api.contentToGenerate
      : local.contentToGenerate,
    relevantDocuments: api.relevantDocuments?.length
      ? api.relevantDocuments
      : local.relevantDocuments,
    relevantProjects: api.relevantProjects?.length
      ? api.relevantProjects
      : local.relevantProjects,
    recommendedDeck: api.recommendedDeck ?? local.recommendedDeck,
  };
}

export function useCallBrief(callId: string) {
  const localBrief = resolveCallBrief(callId);
  return useQuery({
    queryKey: ["call-brief", callId, getImportVersion()],
    queryFn: async () => {
      const local = resolveCallBrief(callId);
      const api = await bffFetch<CallBrief>(`/api/calls/${callId}/brief`);
      if (api && local) return mergeCallBrief(local, api);
      if (api) {
        return { ...api, summarySections: normalizeSummarySections(api.summarySections) };
      }
      if (local) {
        return { ...local, summarySections: normalizeSummarySections(local.summarySections) };
      }
      return local;
    },
    placeholderData: localBrief ?? undefined,
    staleTime: QUERY_STALE_TIME_MS,
    refetchInterval: (query) => {
      const brief = query.state.data;
      if (!brief) return BRIEF_POLL_MS;
      if (brief.agentStatus === "success" || brief.agentStatus === "failed") return false;
      if (brief.artifactPlan?.length || brief.artifactFulfillment?.length) return false;
      return BRIEF_POLL_MS;
    },
  });
}

export interface CallRelevantContent {
  relevantDocuments: RelevantDocument[];
  relevantProjects: RelevantProject[];
  recommendedDeck?: RelevantDocument | null;
  cached?: boolean;
}

export function useCallRelevantContent(callId: string) {
  return useQuery({
    queryKey: ["call-relevant-content", callId],
    queryFn: async () => {
      const api = await bffFetch<CallRelevantContent>(
        `/api/calls/${callId}/relevant-content`
      );
      return (
        api ?? {
          relevantDocuments: [],
          relevantProjects: [],
          recommendedDeck: null,
          cached: false,
        }
      );
    },
    enabled: Boolean(callId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function usePostCallReview(callId: string) {
  const localReview = resolvePostCallReview(callId);
  return useQuery<PostCallReview | null>({
    queryKey: ["post-call", callId, getImportVersion()],
    placeholderData: localReview,
    queryFn: async () => {
      const state = useDcImportsStore.getState();
      if (state.statusOverridesByCallId[callId] === "upcoming") return null;
      if (callId === FRANCHISE_DEMO_CALL_ID) {
        if (
          !state.emailDraftsByCallId[callId] ||
          hasClientUnsafeEmailText(state.emailDraftsByCallId[callId]) ||
          !state.internalEmailDraftsByCallId[callId] ||
          !state.crmTasksByCallId[callId]?.length ||
          !state.postRunMetaByCallId[callId]
        ) {
          state.setPostCallArtifacts(callId, franchiseDemoPostCallArtifacts);
        }
        const base = resolvePostCallReview(callId) ?? franchiseDemoPostReview;
        const snap = state.discoverySnapshotsByCallId[callId] ?? {
          openGaps: franchiseDemoPostReview.openDiscoveryGaps ?? [],
          bantCoverage: franchiseDemoPostReview.discoveryBantCoverage,
        };
        return {
          ...base,
          openDiscoveryGaps: snap.openGaps?.length ? snap.openGaps : base.openDiscoveryGaps,
          discoveryBantCoverage: snap.bantCoverage ?? base.discoveryBantCoverage,
        };
      }

      const api = await bffFetch<PostCallPipelineResult>(`/api/calls/${callId}/post-call`);
      if (api?.review) {
        const emailDraft = withEmailAttachments(
          api.task?.clientEmailDraft ?? api.task?.emailDraft,
          api.emailAttachments
        );
        useDcImportsStore.getState().setPostCallArtifacts(callId, {
          review: api.review,
          emailDraft: sanitizeClientEmailDraft({
            draft: emailDraft,
            accountName: api.accountName ?? callId,
            review: api.review,
            attachments: api.emailAttachments,
          }),
          internalEmailDraft: api.task?.internalEmailDraft ?? buildInternalEmailFallback(callId, api),
          crmTasks: api.task?.taskList ?? api.task?.crmTasks,
          jiraTicket: api.jiraTicket,
          emailAttachments: api.emailAttachments,
          kbSuggestions: api.kbSuggestions,
          envelope: api.envelope,
          coaching: api.coaching,
        });
      }
      const base = api?.review ?? resolvePostCallReview(callId);
      const snap = useDcImportsStore.getState().discoverySnapshotsByCallId[callId];
      if (!base && !snap) return null;
      const merged = base ?? {
        headline: "Post-call review",
        summary: [],
        podScorecard: [],
        learned: [],
      };
      return {
        ...merged,
        openDiscoveryGaps: snap?.openGaps?.length
          ? snap.openGaps
          : merged.openDiscoveryGaps,
        discoveryBantCoverage:
          snap?.bantCoverage ?? merged.discoveryBantCoverage,
      };
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useRunPostCallPipeline(callId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calls/${callId}/post-call`, { method: "POST" });
      if (!res.ok) throw new Error("Post-call pipeline failed");
      return res.json() as Promise<PostCallPipelineResult>;
    },
    onSuccess: (data) => {
      const result = data.discovery?.result ?? data.discovery;
      const openGaps = (result as { openGaps?: string[] })?.openGaps ?? [];
      const checklist = (result as { checklist?: { bantCoverage?: number } })?.checklist;
      const emailDraft = withEmailAttachments(
        data.task?.clientEmailDraft ?? data.task?.emailDraft,
        data.emailAttachments
      );
      useDcImportsStore.getState().setPostCallArtifacts(callId, {
        review: data.review,
        emailDraft: sanitizeClientEmailDraft({
          draft: emailDraft,
          accountName: data.accountName ?? callId,
          review: data.review,
          attachments: data.emailAttachments,
        }),
        internalEmailDraft: data.task?.internalEmailDraft ?? buildInternalEmailFallback(callId, data),
        crmTasks: data.task?.taskList ?? data.task?.crmTasks,
        jiraTicket: data.jiraTicket,
        emailAttachments: data.emailAttachments,
        kbSuggestions: data.kbSuggestions,
        envelope: data.envelope,
        coaching: data.coaching,
        discoverySnapshot: {
          openGaps,
          bantCoverage: checklist?.bantCoverage ?? (result as { bantCoverage?: number })?.bantCoverage,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["post-call", callId] });
      void queryClient.invalidateQueries({ queryKey: ["post-call-tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["call", callId] });
      void queryClient.invalidateQueries({ queryKey: ["calls"] });
      void queryClient.invalidateQueries({ queryKey: ["landing-page", callId] });
    },
  });
}

export function useCreateJiraTicket(callId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ticket: PostCallJiraTicket) => {
      const ticketPayload = Object.fromEntries(
        Object.entries(ticket).filter(([key]) => key !== "subtasks")
      );
      const res = await fetch("/api/integrations/jira/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ticketPayload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Jira ticket creation failed");
      }
      const data = (await res.json()) as {
        key?: string;
        url?: string;
        externalKey?: string;
        externalUrl?: string;
      };
      return { ticket, data };
    },
    onSuccess: ({ ticket, data }) => {
      useDcImportsStore.getState().setPostCallArtifacts(callId, {
        jiraTicket: {
          ...ticket,
          status: "created",
          externalKey: data.externalKey ?? data.key,
          externalUrl: data.externalUrl ?? data.url,
          error: undefined,
        },
      });
      void queryClient.invalidateQueries({ queryKey: ["post-call", callId] });
    },
    onError: (error, ticket) => {
      useDcImportsStore.getState().setPostCallArtifacts(callId, {
        jiraTicket: {
          ...ticket,
          status: "failed",
          error: error instanceof Error ? error.message : "Jira ticket creation failed",
        },
      });
    },
  });
}

export function usePostCallTasks() {
  return useQuery({
    queryKey: ["post-call-tasks", getImportVersion()],
    queryFn: async () =>
      Object.values(useDcImportsStore.getState().crmTasksByCallId).flat() as TaskItem[],
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export const usePostCallCrmTasks = usePostCallTasks;

export function useCoachingCandidates() {
  return useQuery({
    queryKey: ["coaching-candidates"],
    queryFn: async () => {
      const api = await bffFetch<CoachingCandidate[]>("/api/coaching/candidates");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useCoachingInsights() {
  return useQuery({
    queryKey: ["coaching-insights"],
    queryFn: async () => {
      const api = await bffFetch<CoachingInsight[]>("/api/coaching/insights");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useKbAssets() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const snapshot = readKbAssetsSnapshot();
    if (!snapshot?.length) return;
    queryClient.setQueryData<KBAsset[]>(["kb-assets"], (existing) =>
      existing?.length ? existing : snapshot
    );
  }, [queryClient]);

  return useQuery({
    queryKey: ["kb-assets"],
    queryFn: async () => {
      const res = await fetch("/api/kb/assets");
      if (!res.ok) {
        throw new Error(`KB assets request failed (${res.status})`);
      }
      const assets = (await res.json()) as KBAsset[];
      writeKbAssetsSnapshot(assets);
      return assets;
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useKbAsset(assetId: string) {
  return useQuery({
    queryKey: ["kb-asset", assetId],
    queryFn: async () => {
      const api = await bffFetch<KBAsset>(`/api/kb/assets/${assetId}`);
      if (api) return api;
      throw new Error(`Asset not found: ${assetId}`);
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export interface KbAssetSuggestionStats {
  assetId: string;
  suggestedLeadCount: number;
}

export function useKbAssetSuggestionStats(assetId: string | null | undefined) {
  const normalizedAssetId = assetId ?? "";

  return useQuery({
    queryKey: ["kb-asset-suggestion-stats", normalizedAssetId],
    queryFn: async () => {
      const api = await bffFetch<KbAssetSuggestionStats>(
        `/api/kb/assets/${encodeURIComponent(normalizedAssetId)}/suggestion-stats`
      );
      return api ?? { assetId: normalizedAssetId, suggestedLeadCount: 0 };
    },
    enabled: normalizedAssetId.length > 0,
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useKbWatchlist({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["kb-watchlist"],
    queryFn: async () => {
      const api = await bffFetch<KbWatchlistItem[]>("/api/kb/watchlist");
      return api ?? [];
    },
    enabled,
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useKbProjects() {
  return useQuery({
    queryKey: ["kb-projects"],
    queryFn: async () => {
      const api = await bffFetch<KBProject[]>("/api/kb/projects");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useKbProject(projectId: string) {
  return useQuery({
    queryKey: ["kb-project", projectId],
    queryFn: async () => {
      const api = await bffFetch<KBProject>(`/api/kb/projects/${projectId}`);
      if (api) return api;
      throw new Error(`Project not found: ${projectId}`);
    },
    enabled: Boolean(projectId),
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useQuarterlyPatterns() {
  return useQuery({
    queryKey: ["quarterly-patterns"],
    queryFn: async () => {
      const api = await bffFetch<QuarterlyPattern[]>("/api/coaching/quarterly-patterns");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useContentGaps() {
  return useQuery({
    queryKey: ["content-gaps"],
    queryFn: async () => {
      const api = await bffFetch<ContentGap[]>("/api/content/gaps");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

function contentStudioHref(item: ContentToGenerate, call: Call, accountName: string) {
  return buildArtifactStudioHref({
    type: item.type,
    callId: call.id,
    accountName,
    leadName: call.leadName,
    assetName: item.name,
  });
}

export function preDcContentGapKey(item: Pick<PreDcContentGenerationGap, "callId" | "sourceArtifactId" | "sourceItemId" | "name">) {
  return `pre_dc:${item.callId}:${item.sourceArtifactId?.trim() || item.sourceItemId?.trim() || item.name}`;
}

export function postDcContentGapKey(item: Pick<PostDcContentGenerationGap, "callId" | "name">) {
  return `post_dc:${item.callId}:${item.name.trim().toLowerCase()}`;
}

export function contentGapKeyForLead(
  lead: Pick<PreDcContentGenerationGap, "callId" | "sourceArtifactId" | "sourceItemId" | "name">,
  source: "pre-dc" | "post-dc"
) {
  return source === "post-dc"
    ? postDcContentGapKey({ callId: lead.callId, name: lead.name })
    : preDcContentGapKey(lead);
}

function nonOpenGapKeys(gaps: ContentGap[]) {
  return new Set(
    gaps
      .filter((gap) => gap.workflowStatus && gap.workflowStatus !== "open")
      .map((gap) => gap.gapKey)
      .filter((key): key is string => typeof key === "string" && key.length > 0)
  );
}

/** Sidebar + Knowledge Base: count unique content assets to generate (grouped by document, not by lead). */
export function useContentManagerSidebarStats() {
  const { data: preDcGaps = [], isLoading: preLoading, isFetching: preFetching } =
    usePreDcContentGenerationGaps();
  const { data: postDcGaps = [], isLoading: postLoading, isFetching: postFetching } =
    usePostDcContentGenerationGaps();
  const { data: draftGaps = [] } = useContentGaps();

  return useMemo(() => {
    const hidden = nonOpenGapKeys(draftGaps);
    const preDcAssetCount = groupPreDcGaps(
      preDcGaps.filter((gap) => !hidden.has(preDcContentGapKey(gap)))
    ).length;
    const postDcAssetCount = groupPostDcGaps(
      postDcGaps.filter((gap) => !hidden.has(postDcContentGapKey(gap)))
    ).length;
    const toGenerateCount = preDcAssetCount + postDcAssetCount;
    const draftReviewCount = draftGaps.filter((g) => g.workflowStatus === "in_progress").length;

    return {
      toGenerateCount,
      preDcAssetCount,
      postDcAssetCount,
      draftReviewCount,
      isLoading: preLoading || preFetching || postLoading || postFetching,
    };
  }, [
    preDcGaps,
    postDcGaps,
    draftGaps,
    preLoading,
    preFetching,
    postLoading,
    postFetching,
  ]);
}

export function usePreDcContentGenerationGaps() {
  return useQuery({
    queryKey: ["pre-dc-content-generation-gaps", getImportVersion()],
    queryFn: async () => {
      const calls = await fetchCallsFromApi();
      const gaps = await Promise.all(
        calls.map(async (call) => {
          const local = resolveCallBrief(call.id);
          const api = await bffFetch<CallBrief>(`/api/calls/${call.id}/brief`);
          const brief = api && local ? mergeCallBrief(local, api) : api ?? local;
          const accountName = brief?.accountName || call.accountName;
          return (brief?.contentToGenerate ?? []).map((item) => ({
            ...item,
            id: `${call.id}:${item.id}`,
            callId: call.id,
            accountName,
            leadName: call.leadName,
            leadTitle: call.leadTitle,
            industry: call.industry?.trim() || undefined,
            scheduledAt: call.scheduledAt,
            sourceItemId: item.id,
            sourcePath: item.sourcePath || `/calls/${call.id}`,
            contentRequirements: item.contentRequirements || item.reason,
            context: {
              ...(item.context ?? {}),
              source: "pre_dc",
              sourcePath: item.sourcePath || `/calls/${call.id}`,
              callId: call.id,
              accountName,
              leadName: call.leadName,
              industry: call.industry?.trim() || undefined,
              whatToCreate: item.contentRequirements || item.reason,
            },
            studioHref: contentStudioHref(item, call, accountName),
          }));
        })
      );
      return gaps
        .flat()
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime();
        });
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

function collectPostDcMissingGaps(
  calls: Call[],
  postRunMetaByCallId: Record<string, { emailAttachments?: { missing?: PostCallEmailAttachmentMissing[] } }>,
  emailDraftsByCallId: Record<string, PostCallEmailDraft>
): PostDcContentGenerationGap[] {
  const callById = new Map(calls.map((call) => [call.id, call]));
  const seen = new Set<string>();
  const gaps: PostDcContentGenerationGap[] = [];

  const addMissing = (callId: string, item: PostCallEmailAttachmentMissing) => {
    const key = `${callId}:${item.name.trim().toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);

    const call = callById.get(callId);
    gaps.push({
      id: key,
      callId,
      accountName: call?.accountName ?? callId,
      leadName: call?.leadName,
      leadTitle: call?.leadTitle,
      industry: call?.industry?.trim() || undefined,
      scheduledAt: call?.scheduledAt,
      name: item.name,
      type: mapPostDcGapType(item.name),
      priority: 2,
      status: "missing",
      reason: formatPostDcMissingReason(item.requiredData),
      neededFor: "Post-call follow-up and email attachments",
      sourcePath: `/calls/${callId}/post-dc`,
      contentRequirements: item.requiredData,
      context: {
        source: "post_dc",
        sourcePath: `/calls/${callId}/post-dc`,
        callId,
        accountName: call?.accountName ?? callId,
        leadName: call?.leadName,
        industry: call?.industry?.trim() || undefined,
        whatToCreate: item.requiredData,
      },
      studioHref: item.contentStudioLink || "/content?tab=suggestions",
    });
  };

  for (const [callId, meta] of Object.entries(postRunMetaByCallId)) {
    for (const item of meta?.emailAttachments?.missing ?? []) {
      addMissing(callId, item);
    }
  }

  for (const [callId, draft] of Object.entries(emailDraftsByCallId)) {
    for (const item of draft.attachments?.missing ?? []) {
      addMissing(callId, item);
    }
  }

  return gaps.sort((a, b) => {
    const accountCompare = a.accountName.localeCompare(b.accountName);
    if (accountCompare !== 0) return accountCompare;
    return (a.leadName ?? "").localeCompare(b.leadName ?? "");
  });
}

export function usePostDcContentGenerationGaps() {
  return useQuery({
    queryKey: ["post-dc-content-generation-gaps", getImportVersion()],
    queryFn: async () => {
      const calls = await fetchCallsFromApi();
      const { postRunMetaByCallId, emailDraftsByCallId } = useDcImportsStore.getState();
      return collectPostDcMissingGaps(calls, postRunMetaByCallId, emailDraftsByCallId);
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useAgentRuns() {
  return useQuery({
    queryKey: ["agent-runs"],
    queryFn: async () => {
      const api = await bffFetch<AgentRun[]>("/api/agents/runs");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useAgentAudit() {
  return useQuery({
    queryKey: ["agent-audit"],
    queryFn: async () => {
      const api = await bffFetch<ActivityEvent[]>("/api/agents/audit");
      return api ?? [];
    },
    staleTime: QUERY_STALE_TIME_MS,
  });
}

export function useLiveCallStream(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["live-stream", callId],
    queryFn: async () => ({ connected: true, callId }),
    enabled,
    refetchInterval: enabled ? 3000 : false,
  });
}
