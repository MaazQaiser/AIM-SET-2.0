import {
  ingestPostDcRecords,
  ingestPreDcRecords,
} from "@/lib/dc-notes/build-from-import";
import type { PostDCRecord, PreDCRecord } from "@/types/dc-notes";
import type { Call } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";

/** One call per Pre-DC row, scheduledAt from Discovery Call Date/Time (PKT) columns */
export function buildCallsFromPreDc(
  preDcRecords: PreDCRecord[],
  postDcRecords: PostDCRecord[] = []
): {
  calls: Call[];
  briefsByCallId: Record<string, CallBrief>;
  postReviewsByCallId: Record<string, PostCallReview>;
  postDcRecords: PostDCRecord[];
} {
  if (preDcRecords.length === 0) {
    return {
      calls: [],
      briefsByCallId: {},
      postReviewsByCallId: {},
      postDcRecords: [],
    };
  }

  const { calls, briefsByCallId } = ingestPreDcRecords(preDcRecords);

  if (postDcRecords.length === 0) {
    return {
      calls: sortCalls(calls),
      briefsByCallId,
      postReviewsByCallId: {},
      postDcRecords: [],
    };
  }

  const { postReviewsByCallId, updatedCalls, records } = ingestPostDcRecords(
    postDcRecords,
    calls,
    preDcRecords
  );

  return {
    calls: sortCalls(updatedCalls),
    briefsByCallId,
    postReviewsByCallId,
    postDcRecords: records,
  };
}

export function sortCalls(calls: Call[]): Call[] {
  return [...calls].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}
