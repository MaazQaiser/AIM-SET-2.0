"use client";

import { ArrowRight, Check, Circle } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import type { PostDcTabId } from "@/components/post-dc/post-dc-tab-config";
import { cn } from "@/lib/cn";

interface PostNextStepTeaserCardProps {
  proposal: string;
  onGoToActions?: (tab: PostDcTabId) => void;
}

export function PostNextStepTeaserCard({ proposal, onGoToActions }: PostNextStepTeaserCardProps) {
  const trimmed = proposal.trim();
  if (!trimmed) return null;

  const preview =
    trimmed.length > 220 ? `${trimmed.slice(0, 217).trimEnd()}…` : trimmed;

  return (
    <BriefDetailCard title="Next up" variant="highlight">
      <p className="type-body text-muted-foreground leading-relaxed break-words">{preview}</p>
      {onGoToActions ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3 gap-1.5"
          onClick={() => onGoToActions("actions")}
        >
          Open actions
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </BriefDetailCard>
  );
}

interface PostDcActionProgressProps {
  hasProposal: boolean;
  tasksTotal: number;
  tasksDone: number;
  clientEmailReady: boolean;
  internalEmailReady: boolean;
  className?: string;
  compact?: boolean;
}

type StepState = "done" | "current" | "upcoming";

function stepState(done: boolean, current: boolean): StepState {
  if (done) return "done";
  if (current) return "current";
  return "upcoming";
}

export function PostDcActionProgress({
  hasProposal,
  tasksTotal,
  tasksDone,
  clientEmailReady,
  internalEmailReady,
  className,
  compact = false,
}: PostDcActionProgressProps) {
  const tasksComplete = tasksTotal === 0 || tasksDone >= tasksTotal;
  const emailsComplete = clientEmailReady && internalEmailReady;

  const steps: { label: string; state: StepState }[] = [
    { label: "Review", state: hasProposal ? "done" : "current" },
    {
      label: "Tasks",
      state: stepState(tasksComplete, hasProposal && !tasksComplete),
    },
    {
      label: "Email",
      state: stepState(emailsComplete, tasksComplete && !emailsComplete),
    },
    {
      label: "Done",
      state: stepState(tasksComplete && emailsComplete && hasProposal, false),
    },
  ];

  const progressList = (
    <ol
      className={cn("flex flex-wrap items-center gap-2 sm:gap-3", compact && "gap-2")}
      aria-label="Wrap-up progress"
    >
      {steps.map((step, index) => (
        <li key={step.label} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span
            className={cn(
              "inline-flex items-center justify-center rounded-full border font-semibold",
              compact ? "h-5 w-5" : "h-6 w-6 type-caption",
              step.state === "done" &&
                "border-success/40 bg-success/10 text-success",
              step.state === "current" &&
                "border-primary bg-primary/10 text-primary",
              step.state === "upcoming" &&
                "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {step.state === "done" ? (
              <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            ) : (
              <Circle className={cn("fill-current", compact ? "h-2 w-2" : "h-2.5 w-2.5")} />
            )}
          </span>
          <span
            className={cn(
              compact ? "type-caption" : "type-label",
              "font-medium",
              step.state === "upcoming" ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {step.label}
          </span>
          {index < steps.length - 1 && !compact ? (
            <span className="hidden sm:inline text-muted-foreground/50" aria-hidden>
              →
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );

  if (compact) {
    return (
      <div className={cn("min-w-0", className)} aria-label="Wrap-up progress">
        {progressList}
      </div>
    );
  }

  return (
    <BriefDetailCard title="Action workflow" className={className}>
      {progressList}
      <p className="mt-2 type-caption text-muted-foreground">
        Confirm the recommended next step, then review and send follow-up emails.
      </p>
    </BriefDetailCard>
  );
}
