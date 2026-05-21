"use client";

import { useUser } from "@clerk/nextjs";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { personaFromMetadata, type Persona } from "@/lib/persona";
import { usePersonaStore } from "@/stores/use-persona";

export function usePersona(): Persona {
  const devOverride = usePersonaStore((s) => s.devOverride);

  if (isLocalAuthBypassEnabled()) {
    return devOverride ?? "ae";
  }

  const { user } = useUser();
  if (devOverride) return devOverride;
  if (user?.publicMetadata) {
    return personaFromMetadata(user.publicMetadata as Record<string, unknown>);
  }
  return "ae";
}

export function useSetPersonaOverride() {
  return usePersonaStore((s) => s.setDevOverride);
}
