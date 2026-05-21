"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDcImportsStore } from "@/stores/use-dc-imports";

/** Loads DC notes from API and refreshes TanStack Query caches. */
export function DcImportsHydrator() {
  const loadFromDb = useDcImportsStore((s) => s.loadFromDb);
  const queryClient = useQueryClient();

  useEffect(() => {
    void loadFromDb()
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["calls"] });
        void queryClient.invalidateQueries({ queryKey: ["call"] });
        void queryClient.invalidateQueries({ queryKey: ["call-brief"] });
        void queryClient.invalidateQueries({ queryKey: ["post-call"] });
        void queryClient.invalidateQueries({ queryKey: ["kb-assets"] });
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : "Could not load DC notes from the API";
        toast.error(message, {
          description:
            "Check Railway INTERNAL_SECRET matches Vercel INTERNAL_API_SECRET, then re-import your CSV.",
        });
      });
  }, [loadFromDb, queryClient]);

  return null;
}
