"use client";

import { createContext, useContext, type ReactNode } from "react";

const ClerkGateContext = createContext(false);

/** Mirrors server `isClerkConfigured()` — do not read env in client hooks. */
export function ClerkGateProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <ClerkGateContext.Provider value={enabled}>{children}</ClerkGateContext.Provider>
  );
}

export function useClerkGate(): boolean {
  return useContext(ClerkGateContext);
}
