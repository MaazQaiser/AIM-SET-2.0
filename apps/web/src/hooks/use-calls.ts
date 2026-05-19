"use client";

import { useQuery } from "@tanstack/react-query";

export function useCalls() {
  return useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const res = await fetch("/api/calls");
      if (!res.ok) throw new Error("Failed to fetch calls");
      return res.json();
    },
  });
}

export function useCall(callId: string) {
  return useQuery({
    queryKey: ["calls", callId],
    queryFn: async () => {
      const res = await fetch(`/api/calls/${callId}`);
      if (!res.ok) throw new Error("Failed to fetch call");
      return res.json();
    },
    enabled: !!callId,
  });
}
