"use client";

import { usePersona, useSetPersonaOverride } from "@/hooks/use-persona";
import { PERSONA_LABELS, type Persona } from "@/lib/persona";

const PERSONAS: Persona[] = ["ae", "leadership", "content-owner"];

export function PersonaSwitcher() {
  const persona = usePersona();
  const setOverride = useSetPersonaOverride();

  return (
    <select
      value={persona}
      onChange={(e) => setOverride(e.target.value as Persona)}
      className="h-10 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label="Switch persona (dev)"
    >
      {PERSONAS.map((p) => (
        <option key={p} value={p}>
          {PERSONA_LABELS[p]}
        </option>
      ))}
    </select>
  );
}
