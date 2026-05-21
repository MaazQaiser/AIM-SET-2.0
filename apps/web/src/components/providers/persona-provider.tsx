"use client";

import { useUser } from "@clerk/nextjs";
import { createContext, useContext, type ReactNode } from "react";
import { useClerkGate } from "@/components/providers/clerk-gate";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";
import { personaFromMetadata, type Persona } from "@/lib/persona";
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

/** Persona from Clerk only when server enabled ClerkProvider (see root layout). */
export function PersonaProvider({ children }: { children: ReactNode }) {
  const clerkEnabled = useClerkGate();

  if (isLocalAuthBypassEnabled() || !clerkEnabled) {
    return <PersonaFallback>{children}</PersonaFallback>;
  }

  return <PersonaFromClerk>{children}</PersonaFromClerk>;
}

export function usePersonaContext(): Persona {
  return useContext(PersonaContext);
}
