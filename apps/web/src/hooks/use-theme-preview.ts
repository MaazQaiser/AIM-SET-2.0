"use client";

import { createContext, useContext } from "react";

export type ThemePreview = "default" | "intercom";

export const ThemePreviewContext = createContext<ThemePreview>("default");

export function useThemePreview() {
  const theme = useContext(ThemePreviewContext);
  return {
    theme,
    isIntercom: theme === "intercom",
  };
}

export function parseThemePreviewParam(value: string | null): ThemePreview {
  return value === "intercom" ? "intercom" : "default";
}
