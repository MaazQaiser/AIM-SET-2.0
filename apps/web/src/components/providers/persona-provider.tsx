"use client";

import { useUser } from "@clerk/nextjs";
import { createContext, useContext, type ReactNode } from "react";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { personaFromMetadata, type Persona } from "@/lib/persona";
import { isClerkConfigured } from "@/lib/public-env";
import { usePersonaStore } from "@/stores/use-persona";

const PersonaContext = createContext<Persona>("ae");

function PersonaFromClerk({ children }: { children: ReactNode }) {
  const devOverride = usePersonaStore((s) => s.devOverride);
  const { user } = useUser();

  let persona: Persona = "ae";
  if (devOverride) {
    persona = devOverride;
  } else if (user?.publicMetadata) {
    persona = personaFromMetadata(user.publicMetadata as Record<string, unknown>);
  }

  return <PersonaContext.Provider value={persona}>{children}</PersonaContext.Provider>;
}

function PersonaFallback({ children }: { children: ReactNode }) {
  const devOverride = usePersonaStore((s) => s.devOverride);
  return (
    <PersonaContext.Provider value={devOverride ?? "ae"}>
      {children}
    </PersonaContext.Provider>
  );
}

/** Supplies persona without calling Clerk hooks when auth is not configured. */
export function PersonaProvider({ children }: { children: ReactNode }) {
  if (isLocalAuthBypassEnabled() || !isClerkConfigured()) {
    return <PersonaFallback>{children}</PersonaFallback>;
  }
  return <PersonaFromClerk>{children}</PersonaFromClerk>;
}

export function usePersonaContext(): Persona {
  return useContext(PersonaContext);
}
