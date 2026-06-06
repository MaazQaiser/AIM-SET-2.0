"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Section block inside a Post-DC expand modal. */
export function PostDcModalSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "space-y-3 border-b border-border/50 pb-6 last:border-b-0 last:pb-0",
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export const POST_DC_EXPAND_MODAL_CLASS =
  "w-[min(90vw,1280px)] max-w-[90vw] h-[min(88vh,920px)] max-h-[88vh]";
