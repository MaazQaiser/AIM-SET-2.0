"use client";

import { useUser } from "@clerk/nextjs";
import { personaFromMetadata, type Persona } from "@/lib/persona";
import { usePersonaStore } from "@/stores/use-persona";

export function usePersona(): Persona {
  const { user } = useUser();
  const devOverride = usePersonaStore((s) => s.devOverride);

  if (devOverride) return devOverride;
  if (user?.publicMetadata) {
    return personaFromMetadata(user.publicMetadata as Record<string, unknown>);
  }
  return "ae";
}

export function useSetPersonaOverride() {
  return usePersonaStore((s) => s.setDevOverride);
}
