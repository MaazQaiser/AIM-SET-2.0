"use client";

import { AlertCircle } from "lucide-react";
import type { UnansweredQuestionPayload } from "@/types";

interface UnansweredQuestionsListProps {
  questions: UnansweredQuestionPayload[];
  /** Hide section title when wrapped in LiveCollapsibleSection */
  compact?: boolean;
}

export function UnansweredQuestionsList({ questions, compact }: UnansweredQuestionsListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
          <AlertCircle className="h-3 w-3 text-amber-600" />
          Unanswered prospect questions
        </p>
      )}
      {questions.map((q, i) => (
        <div
          key={q.id ?? q.question_id ?? i}
          className="rounded-md border border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-1.5 text-xs"
        >
          <p className="text-foreground">{q.text}</p>
          {q.seconds_unanswered != null && (
            <p className="text-muted-foreground mt-0.5">
              Open ~{Math.round(q.seconds_unanswered)}s
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
