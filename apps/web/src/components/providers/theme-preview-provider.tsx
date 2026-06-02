"use client";

import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  parseThemePreviewParam,
  ThemePreviewContext,
} from "@/hooks/use-theme-preview";
import { ThemePreviewBanner } from "@/components/layout/theme-preview-banner";

export function DashboardThemePreview({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const theme = parseThemePreviewParam(searchParams.get("theme"));
  const isIntercom = theme === "intercom";

  return (
    <ThemePreviewContext.Provider value={theme}>
      <div className={cn("font-sans", isIntercom && "theme-intercom")}>
        {isIntercom && <ThemePreviewBanner />}
        {children}
      </div>
    </ThemePreviewContext.Provider>
  );
}
