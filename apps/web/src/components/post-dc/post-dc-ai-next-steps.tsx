"use client";

import { cn } from "@/lib/cn";
import { briefBodyForegroundClass } from "@/components/pre-call/brief-detail-card";

function recommendationLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/** Plain AI next-steps block — matches Pre-DC body typography. */
export function PostDcAiNextSteps({
  text,
  showLabel = true,
  className,
}: {
  text: string;
  showLabel?: boolean;
  className?: string;
}) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const lines = recommendationLines(trimmed);

  return (
    <section className={cn("w-full min-w-0 pt-4 mt-3 border-t border-border/60", className)}>
      {showLabel ? (
        <h3 className="mb-2 type-label text-muted-foreground">
          AI recommended next steps
        </h3>
      ) : null}
      {lines.length > 1 ? (
        <ul className={cn("list-disc space-y-1.5 pl-4 post-dc-copy", briefBodyForegroundClass)}>
          {lines.map((line) => (
            <li key={line} className="break-words">
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn("post-dc-copy whitespace-pre-wrap break-words", briefBodyForegroundClass)}>
          {trimmed}
        </p>
      )}
    </section>
  );
}
