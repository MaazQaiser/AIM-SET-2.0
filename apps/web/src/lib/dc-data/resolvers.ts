import {
  buildBriefFromPreDc,
  buildPostDcBriefPreview,
  buildPostReviewFromPostDc,
  slugifyCompany,
} from "@/lib/dc-notes/build-from-import";
import { buildCallsFromPreDc } from "@/lib/dc-data/build-calls-from-pre-dc";
import { preDcField } from "@/types/dc-notes";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import type { Call } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/mock-data";

/** Every Pre-DC CSV row → one call, dated from Discovery Call Date/Time (PKT) */
export function resolveCalls(): Call[] {
  const { preDcRecords, postDcRecords } = useDcImportsStore.getState();
  return buildCallsFromPreDc(preDcRecords, postDcRecords).calls;
}

export function resolveCall(callId: string): Call | undefined {
  return resolveCalls().find((c) => c.id === callId);
}

export function resolveCallBrief(callId: string): CallBrief | null {
  const state = useDcImportsStore.getState();
  const preRecord = state.preDcRecords.find(
    (r) => slugifyCompany(preDcField(r, "companyName")) === callId
  );

  if (!preRecord) return null;

  let brief = buildBriefFromPreDc(preRecord, callId);

  const postRecord = state.postDcRecords.find((r) => r.matchedCallId === callId);
  if (postRecord) {
    brief = {
      ...brief,
      postDcPreview: buildPostDcBriefPreview(postRecord),
    };
  }

  return brief;
}

export function resolvePostCallReview(callId: string): PostCallReview | null {
  const { postDcRecords, preDcRecords } = useDcImportsStore.getState();
  const { postReviewsByCallId } = buildCallsFromPreDc(preDcRecords, postDcRecords);
  if (postReviewsByCallId[callId]) return postReviewsByCallId[callId];

  const record = postDcRecords.find((r) => r.matchedCallId === callId);
  if (!record) return null;

  return buildPostReviewFromPostDc(record);
}

export function hasCsvData(): boolean {
  return useDcImportsStore.getState().preDcRecords.length > 0;
}

export function getImportVersion(): number {
  return useDcImportsStore.getState().importVersion;
}
