"use client";

import { create } from "zustand";
import type { Call } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/brief-types";
import { buildCallsFromPreDc } from "@/lib/dc-data/build-calls-from-pre-dc";
import type { PostDCRecord, PreDCRecord } from "@/types/dc-notes";

interface DcImportsState {
  preDcRecords: PreDCRecord[];
  postDcRecords: PostDCRecord[];
  calls: Call[];
  briefsByCallId: Record<string, CallBrief>;
  postReviewsByCallId: Record<string, PostCallReview>;
  preDcFileName: string | null;
  postDcFileName: string | null;
  importedAt: string | null;
  importVersion: number;
  loadFromDb: () => Promise<void>;
  clearImports: () => Promise<void>;
}

const emptyState = {
  preDcRecords: [] as PreDCRecord[],
  postDcRecords: [] as PostDCRecord[],
  calls: [] as Call[],
  briefsByCallId: {} as Record<string, CallBrief>,
  postReviewsByCallId: {} as Record<string, PostCallReview>,
  preDcFileName: null as string | null,
  postDcFileName: null as string | null,
  importedAt: null as string | null,
  importVersion: 0,
};

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
  loadFromDb: async () => {
    const res = await fetch("/api/dc-notes");
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
    });
  },
  clearImports: async () => {
    set({ ...emptyState, importVersion: get().importVersion + 1 });
  },
}));
