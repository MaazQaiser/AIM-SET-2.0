"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Persona } from "@/lib/persona";

interface PersonaState {
  devOverride: Persona | null;
  setDevOverride: (persona: Persona | null) => void;
}

export const usePersonaStore = create<PersonaState>()(
  persist(
    (set) => ({
      devOverride: null,
      setDevOverride: (devOverride) => set({ devOverride }),
    }),
    { name: "dc-persona-override" }
  )
);
