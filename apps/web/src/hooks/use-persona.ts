"use client";

import { usePersonaContext } from "@/components/providers/persona-provider";
import { usePersonaStore } from "@/stores/use-persona";

export function usePersona() {
  return usePersonaContext();
}

export function useSetPersonaOverride() {
  return usePersonaStore((s) => s.setDevOverride);
}
