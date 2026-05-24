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
        const isLocal =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const description = message.includes("Cannot reach the API")
          ? isLocal
            ? "Start the API: cd services/api && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000"
            : "Check Railway INTERNAL_SECRET matches Vercel INTERNAL_API_SECRET, then re-import your CSV."
          : message.includes("INTERNAL_API_SECRET")
            ? "Set INTERNAL_API_SECRET in apps/web/.env.local to match INTERNAL_SECRET in services/api/.env"
            : isLocal
              ? "Ensure the Python API is running on port 8000, then refresh the page."
              : "Check Railway INTERNAL_SECRET matches Vercel INTERNAL_API_SECRET, then re-import your CSV.";
        toast.error(message, { description });
      });
  }, [loadFromDb, queryClient]);

  return null;
}
