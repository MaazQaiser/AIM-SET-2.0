"use client";

import type { ReactNode } from "react";
import { useThemePreview } from "@/hooks/use-theme-preview";
import { cn } from "@/lib/cn";

interface AiGradientTextProps {
  children: ReactNode;
  className?: string;
  as?: "span" | "p" | "h2" | "h3";
}

/** Gradient label styling used for AI-generated copy (matches primary / Intercom themes). */
export function AiGradientText({ children, className, as: Tag = "span" }: AiGradientTextProps) {
  const { isIntercom } = useThemePreview();

  return (
    <Tag
      className={cn(
        "bg-clip-text text-transparent bg-gradient-to-r font-semibold",
        isIntercom
          ? "from-[#ff5600] via-[#ff2067] to-[#ff5600]"
          : "from-primary via-violet-500 to-sky-500",
        className
      )}
    >
      {children}
    </Tag>
  );
}
