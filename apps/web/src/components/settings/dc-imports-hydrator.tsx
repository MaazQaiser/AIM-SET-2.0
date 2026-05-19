"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
      .catch(() => {
        // Supabase may be unset until credentials are configured
      });
  }, [loadFromDb, queryClient]);

  return null;
}
