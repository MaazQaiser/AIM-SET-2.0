import {
  buildBriefFromPreDc,
  buildPostDcBriefPreview,
  buildPostReviewFromPostDc,
  findPreDcRecordForCall,
  slugifyCompany,
} from "@/lib/dc-notes/build-from-import";
import { buildCallsFromPreDc } from "@/lib/dc-data/build-calls-from-pre-dc";
import {
  FRANCHISE_DEMO_CALL_ID,
  franchiseDemoBrief,
  franchiseDemoCall,
  franchiseDemoPostReview,
} from "@/lib/demo/franchise-ai-platform-demo";
import { preDcField } from "@/types/dc-notes";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import type { Call, CallStatus } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";

function applyResolvedStatuses(
  calls: Call[],
  postReviewsByCallId: Record<string, PostCallReview>,
  statusOverridesByCallId: Record<string, CallStatus>
): Call[] {
  return calls.map((call) => {
    const override = statusOverridesByCallId[call.id];
    if (override) return { ...call, status: override };
    if (postReviewsByCallId[call.id]) return { ...call, status: "completed" };
    return call;
  });
}

function resolveDemoCall(): Call {
  const state = useDcImportsStore.getState();
  const override = state.statusOverridesByCallId?.[FRANCHISE_DEMO_CALL_ID];
  return {
    ...franchiseDemoCall,
    status: override ?? "completed",
  };
}

/** Calls from imported DC notes CSV (real data, not mocks). */
export function resolveCalls(): Call[] {
  const state = useDcImportsStore.getState();
  const preDcRecords = state.preDcRecords ?? [];
  const postDcRecords = state.postDcRecords ?? [];
  const postReviewsByCallId = state.postReviewsByCallId ?? {};
  const statusOverridesByCallId = state.statusOverridesByCallId ?? {};
  const calls =
    preDcRecords.length === 0
      ? state.calls ?? []
      : buildCallsFromPreDc(preDcRecords, postDcRecords).calls;

  return applyResolvedStatuses(calls, postReviewsByCallId, statusOverridesByCallId);
}

export function resolveCallStatusOverrides(): Record<string, CallStatus> {
  return useDcImportsStore.getState().statusOverridesByCallId ?? {};
}

export function resolveFranchiseDemoCallForList(): Call {
  return resolveDemoCall();
}

/** Calls from imported DC notes CSV (real data, not mocks). */
export function hasCsvData(): boolean {
  return (useDcImportsStore.getState().preDcRecords ?? []).length > 0;
}

export function getImportVersion(): number {
  return useDcImportsStore.getState().importVersion ?? 0;
}

export function resolveCall(callId: string): Call | undefined {
  if (callId === FRANCHISE_DEMO_CALL_ID) return resolveDemoCall();
  return resolveCalls().find((c) => c.id === callId);
}

export function resolveCallBrief(callId: string): CallBrief | null {
  const state = useDcImportsStore.getState();
  const preDcRecords = state.preDcRecords ?? [];
  const call = resolveCall(callId);
  const accountName =
    call?.accountName ??
    (callId === FRANCHISE_DEMO_CALL_ID ? franchiseDemoCall.accountName : undefined);

  const preRecord = findPreDcRecordForCall(preDcRecords, callId, accountName);

  if (preRecord) {
    const canonicalId = slugifyCompany(preDcField(preRecord, "companyName"));
    let brief = buildBriefFromPreDc(preRecord, callId);
    const stored =
      state.briefsByCallId?.[canonicalId] ??
      state.briefsByCallId?.[callId] ??
      state.briefsByCallId?.[FRANCHISE_DEMO_CALL_ID];
    if (stored) {
      brief = { ...brief, ...stored, callId };
    }

    const postRecord = (state.postDcRecords ?? []).find(
      (r) =>
        r.matchedCallId === callId ||
        r.matchedCallId === canonicalId ||
        r.matchedCallId === FRANCHISE_DEMO_CALL_ID
    );
    if (postRecord && state.statusOverridesByCallId?.[callId] !== "upcoming") {
      brief = {
        ...brief,
        postDcPreview: buildPostDcBriefPreview(postRecord),
      };
    }
    return brief;
  }

  if (callId === FRANCHISE_DEMO_CALL_ID) {
    return franchiseDemoBrief;
  }

  if (preDcRecords.length === 0) {
    return state.briefsByCallId?.[callId] ?? null;
  }

  return state.briefsByCallId?.[callId] ?? null;
}

export function resolvePostCallReview(callId: string): PostCallReview | null {
  const state = useDcImportsStore.getState();
  if (state.statusOverridesByCallId?.[callId] === "upcoming") return null;
  const cached = state.postReviewsByCallId?.[callId];
  if (cached) return cached;

  const preDcRecords = state.preDcRecords ?? [];
  const postDcRecords = state.postDcRecords ?? [];
  if (preDcRecords.length === 0) {
    if (callId === FRANCHISE_DEMO_CALL_ID) return franchiseDemoPostReview;
    return state.postReviewsByCallId?.[callId] ?? null;
  }

  const { postReviewsByCallId } = buildCallsFromPreDc(preDcRecords, postDcRecords);
  if (postReviewsByCallId[callId]) return postReviewsByCallId[callId];

  const record = postDcRecords.find((r) => r.matchedCallId === callId);
  if (!record) return null;

  return buildPostReviewFromPostDc(record);
}

export function resolvePostDcRecordForCall(callId: string) {
  const state = useDcImportsStore.getState();
  const preDcRecords = state.preDcRecords ?? [];
  const postDcRecords = state.postDcRecords ?? [];
  if (postDcRecords.length === 0) return undefined;

  const direct = postDcRecords.find((r) => r.matchedCallId === callId);
  if (direct) return direct;

  const call = resolveCall(callId);
  const preRecord = findPreDcRecordForCall(
    preDcRecords,
    callId,
    call?.accountName
  );
  if (!preRecord) return undefined;

  const canonicalId = slugifyCompany(preDcField(preRecord, "companyName"));
  return postDcRecords.find(
    (r) =>
      r.matchedCallId === canonicalId ||
      r.matchedCallId === callId
  );
}
