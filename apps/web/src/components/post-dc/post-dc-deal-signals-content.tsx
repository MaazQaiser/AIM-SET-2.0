"use client";

import { AlertTriangle, Users } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import type { PostDcDealSignals } from "@/lib/brief-types";
import { isNotFitLeadStage } from "@/lib/post-dc/deal-signals";
import { cn } from "@/lib/cn";

function formatAttendees(raw?: string): string {
  if (!raw?.trim()) return "";
  return raw
    .split(/\n|,/)
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
}

function icpIsYes(value: string): boolean {
  return /^yes$/i.test(value.trim());
}

interface SignalFieldProps {
  label: string;
  value: string;
  highlight?: "success" | "destructive" | "default";
  compact?: boolean;
}

function SignalField({ label, value, highlight = "default", compact = false }: SignalFieldProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/50 bg-muted/10 min-w-0",
        compact ? "px-2 py-1" : "px-3 py-2.5"
      )}
    >
      <dt
        className={cn(
          "font-semibold text-muted-foreground leading-none",
          compact ? "text-[10px]" : "text-xs"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "font-medium leading-snug break-words capitalize",
          compact ? "text-[11px] mt-0.5" : "text-[0.9375rem] mt-0.5",
          highlight === "success" && "text-success",
          highlight === "destructive" && "text-destructive",
          highlight === "default" && "text-foreground"
        )}
      >
        {value}
      </dd>
    </div>
  );
}

interface PostDcDealSignalsContentProps {
  signals: PostDcDealSignals;
  leadStage: string;
  expanded?: boolean;
  showAttendees?: boolean;
  /** Hide deadline note — shown in call summary instead */
  hideDeadlineNote?: boolean;
}

export function PostDcDealSignalsContent({
  signals,
  leadStage,
  expanded = false,
  showAttendees = false,
  hideDeadlineNote = true,
}: PostDcDealSignalsContentProps) {
  const notFit = isNotFitLeadStage(leadStage);
  const attendees = formatAttendees(signals.attendees);

  const fields: SignalFieldProps[] = [
    signals.leadStage
      ? {
          label: "Lead stage",
          value: signals.leadStage,
          highlight: notFit ? "destructive" : "default",
        }
      : null,
    signals.accountsAnnualPotential
      ? { label: "Annual potential", value: signals.accountsAnnualPotential }
      : null,
    signals.engagementModel ? { label: "Engagement model", value: signals.engagementModel } : null,
    signals.serviceLine ? { label: "Service line", value: signals.serviceLine } : null,
    signals.icpBucketCorrect
      ? {
          label: "Pre-DC ICP correct",
          value: signals.icpBucketCorrect,
          highlight: icpIsYes(signals.icpBucketCorrect) ? "success" : "default",
        }
      : null,
  ].filter(Boolean) as SignalFieldProps[];

  if (
    fields.length === 0 &&
    !signals.reasonNotFit &&
    (!signals.additionalInfo || hideDeadlineNote) &&
    !attendees
  ) {
    return null;
  }

  const compact = !expanded;

  return (
    <div className={cn("space-y-2", expanded && "space-y-3")}>
      {showAttendees && attendees ? (
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
          <Users className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">On the call</p>
            <p className="text-[0.9375rem] text-foreground leading-relaxed break-words mt-0.5">
              {attendees}
            </p>
          </div>
        </div>
      ) : null}

      {fields.length > 0 ? (
        <dl
          className={cn(
            "grid gap-1.5",
            expanded ? "sm:grid-cols-2 lg:grid-cols-3 gap-2" : "grid-cols-2"
          )}
        >
          {fields.map((field) => (
            <SignalField key={field.label} {...field} compact={compact} />
          ))}
        </dl>
      ) : null}

      {notFit && signals.reasonNotFit ? (
        <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
              Reason not a fit
            </p>
            <p className="text-[0.9375rem] leading-relaxed text-foreground/90 break-words mt-0.5">
              {signals.reasonNotFit}
            </p>
          </div>
        </div>
      ) : null}

      {!hideDeadlineNote && signals.additionalInfo ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground">Deadline / note</p>
          <p className="text-[0.9375rem] leading-relaxed text-foreground break-words mt-0.5">
            {signals.additionalInfo}
          </p>
        </div>
      ) : null}

      {expanded && leadStage && notFit ? (
        <Badge variant="destructive" className="text-[10px]">
          Not a fit — nurture or close-out path
        </Badge>
      ) : null}
    </div>
  );
}

export function dealSignalsAttendeesLabel(signals: PostDcDealSignals): string | null {
  const formatted = formatAttendees(signals.attendees);
  if (!formatted) return null;
  const names = formatted.split(", ");
  if (names.length <= 2) return formatted;
  return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}
