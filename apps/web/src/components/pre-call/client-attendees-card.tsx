"use client";

import { useState } from "react";
import { Linkedin, Clock, MessageCircle, ExternalLink } from "lucide-react";
import { BriefDetailCard, briefDetailDialogClass } from "@/components/pre-call/brief-detail-card";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { cn } from "@/lib/cn";
import type { ClientAttendee, InfluenceLevel } from "@/lib/brief-types";

interface ClientAttendeesCardProps {
  attendees: ClientAttendee[];
  embedded?: boolean;
}

const INFLUENCE_CONFIG: Record<InfluenceLevel, { label: string; className: string }> = {
  "decision-maker": { label: "Decision maker", className: "bg-blue-100 text-blue-700 border-blue-200" },
  influencer: { label: "Influencer", className: "bg-purple-100 text-purple-700 border-purple-200" },
  champion: { label: "Champion", className: "bg-green-100 text-green-700 border-green-200" },
  blocker: { label: "Blocker", className: "bg-red-100 text-red-700 border-red-200" },
  evaluator: { label: "Evaluator", className: "bg-orange-100 text-orange-700 border-orange-200" },
};

function formatRelativeDays(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function ClientAttendeeDetailDialog({
  attendee,
  open,
  onOpenChange,
}: {
  attendee: ClientAttendee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attendee) return null;

  const influence = INFLUENCE_CONFIG[attendee.influenceLevel];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(briefDetailDialogClass, "max-w-lg max-h-[min(90vh,640px)] overflow-y-auto")}
      >
        <DialogHeader className="pr-8">
          <div className="flex items-start gap-3">
            <ParticipantAvatar name={attendee.name} kind="external" size="lg" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left">{attendee.name}</DialogTitle>
              <DialogDescription className="text-left mt-1">
                {attendee.title}
                {attendee.department ? ` · ${attendee.department}` : ""}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    influence.className
                  )}
                >
                  {influence.label}
                </span>
                {attendee.lastContactedAt ? (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Last contact {formatRelativeDays(attendee.lastContactedAt)}
                  </span>
                ) : (
                  <span className="text-xs text-warning font-medium">First meeting</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <section>
            <h4 className="text-[10px] font-semibold text-muted-foreground mb-1.5">
              Background
            </h4>
            <p className="text-sm text-foreground/90 leading-relaxed">{attendee.background}</p>
          </section>

          {attendee.priorInteractionNote && (
            <section className="rounded-lg bg-primary/5 px-3 py-3">
              <div className="flex gap-2">
                <MessageCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[10px] font-semibold text-primary mb-1">
                    Agent note
                  </h4>
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {attendee.priorInteractionNote}
                  </p>
                </div>
              </div>
            </section>
          )}

          {!attendee.lastContactedAt && (
            <p className="text-sm text-warning leading-relaxed">
              No prior interaction on record — plan a crisp introduction and confirm role on the call.
            </p>
          )}

          {attendee.linkedinUrl && (
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <a href={attendee.linkedinUrl} target="_blank" rel="noopener noreferrer">
                <Linkedin className="h-4 w-4 mr-2" />
                View LinkedIn
                <ExternalLink className="h-3 w-3 ml-2 opacity-60" />
              </a>
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClientAttendeesCard({
  attendees,
  embedded = false,
}: ClientAttendeesCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = attendees.find((a) => a.id === selectedId) ?? null;

  const decisionMakers = attendees.filter(
    (a) => a.influenceLevel === "decision-maker" || a.influenceLevel === "blocker"
  );
  const others = attendees.filter(
    (a) => a.influenceLevel !== "decision-maker" && a.influenceLevel !== "blocker"
  );
  const sorted = [...decisionMakers, ...others];

  return (
    <>
      <BriefDetailCard
        title="Client attendees"
        embedded={embedded}
        sourceInfo={{
          source: "Imported lead/contact data",
          detail:
            "Attendee details are taken from the lead fields and contact history available in the imported data. Influence labels are prep hints, not confirmed org-chart truth.",
        }}
        headerExtra={
          <span className="text-xs text-muted-foreground shrink-0">{attendees.length}</span>
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(INFLUENCE_CONFIG).map(([key, cfg]) => {
            const count = attendees.filter((a) => a.influenceLevel === key).length;
            if (count === 0) return null;
            return (
              <span
                key={key}
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  cfg.className
                )}
              >
                {count} {cfg.label}
              </span>
            );
          })}
        </div>

        <ul className="divide-y divide-border">
          {sorted.map((attendee) => {
            const influence = INFLUENCE_CONFIG[attendee.influenceLevel];
            return (
              <li key={attendee.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <ParticipantAvatar name={attendee.name} kind="external" size="md" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{attendee.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {attendee.title}
                    {attendee.department ? ` · ${attendee.department}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden sm:inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    influence.className
                  )}
                >
                  {influence.label}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 text-xs"
                  onClick={() => setSelectedId(attendee.id)}
                >
                  Details
                </Button>
              </li>
            );
          })}
        </ul>
      </BriefDetailCard>

      <ClientAttendeeDetailDialog
        attendee={selected}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
