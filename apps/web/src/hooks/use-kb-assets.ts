"use client";

import { useQuery } from "@tanstack/react-query";

export function useKBAssets() {
  return useQuery({
    queryKey: ["kb-assets"],
    queryFn: async () => {
      const res = await fetch("/api/kb/assets");
      if (!res.ok) throw new Error("Failed to fetch KB assets");
      return res.json();
    },
  });
}
