"use client";

import type { ObjectionPayload } from "@/types";

interface ObjectionCardProps {
  objection: ObjectionPayload;
}

export function ObjectionCard({ objection }: ObjectionCardProps) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-900 p-3 space-y-2">
      <p className="type-label text-amber-900 dark:text-amber-200">Objection detected</p>
      <p className="type-body text-foreground">{objection.objection_text}</p>
      {objection.counter_points?.length > 0 && (
        <ul className="type-caption text-muted-foreground list-disc pl-4 space-y-1">
          {objection.counter_points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
