"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Call } from "@/types";
import type { CallBrief, PostCallReview } from "@/lib/mock-data";
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
  setPreDcImport: (records: PreDCRecord[], fileName: string) => void;
  setPostDcImport: (records: PostDCRecord[], fileName: string) => void;
  clearImports: () => void;
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

export const useDcImportsStore = create<DcImportsState>()(
  persist(
    (set, get) => ({
      ...emptyState,
      setPreDcImport: (records, fileName) => {
        const state = get();
        const built = buildCallsFromPreDc(records, state.postDcRecords);

        set({
          preDcRecords: records,
          preDcFileName: fileName,
          calls: built.calls,
          briefsByCallId: built.briefsByCallId,
          postDcRecords: built.postDcRecords,
          postReviewsByCallId: built.postReviewsByCallId,
          importedAt: new Date().toISOString(),
          importVersion: state.importVersion + 1,
        });
      },
      setPostDcImport: (records, fileName) => {
        const state = get();
        const built = buildCallsFromPreDc(state.preDcRecords, records);

        set({
          postDcRecords: built.postDcRecords,
          postDcFileName: fileName,
          calls: built.calls,
          briefsByCallId: built.briefsByCallId,
          postReviewsByCallId: built.postReviewsByCallId,
          importedAt: new Date().toISOString(),
          importVersion: state.importVersion + 1,
        });
      },
      clearImports: () => set({ ...emptyState, importVersion: get().importVersion + 1 }),
    }),
    {
      name: "dc-notes-imports",
      onRehydrateStorage: () => (state) => {
        if (!state?.preDcRecords.length) return;
        const built = buildCallsFromPreDc(state.preDcRecords, state.postDcRecords);
        state.calls = built.calls;
        state.briefsByCallId = built.briefsByCallId;
        state.postReviewsByCallId = built.postReviewsByCallId;
        state.postDcRecords = built.postDcRecords;
      },
    }
  )
);
