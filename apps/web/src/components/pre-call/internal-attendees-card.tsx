"use client";

import { useState } from "react";
import { Users, Sparkles } from "lucide-react";
import { BriefDetailCard, briefDetailDialogClass } from "@/components/pre-call/brief-detail-card";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@dc-copilot/ui/components/avatar";
import { cn } from "@/lib/cn";
import type { InternalAttendee } from "@/lib/brief-types";

interface InternalAttendeesCardProps {
  attendees: InternalAttendee[];
  embedded?: boolean;
}

const ROLE_STYLES: Record<
  InternalAttendee["role"],
  { label: string; className: string }
> = {
  ae: { label: "AE", className: "bg-primary/10 text-primary border-primary/20" },
  se: { label: "SE", className: "bg-success/10 text-success border-success/20" },
  designer: {
    label: "Designer",
    className: "bg-warning/10 text-warning-foreground border-warning/20",
  },
};

function InternalAttendeeDetailDialog({
  attendee,
  open,
  onOpenChange,
}: {
  attendee: InternalAttendee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!attendee) return null;

  const role = ROLE_STYLES[attendee.role];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(briefDetailDialogClass, "max-w-lg max-h-[min(90vh,560px)] overflow-y-auto")}
      >
        <DialogHeader className="pr-8">
          <div className="flex items-start gap-3">
            <Avatar className="h-12 w-12 shrink-0">
              {attendee.avatarUrl && (
                <AvatarImage src={attendee.avatarUrl} alt={attendee.name} />
              )}
              <AvatarFallback className={cn("text-sm font-bold", role.className)}>
                {attendee.initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left">{attendee.name}</DialogTitle>
              <DialogDescription className="text-left mt-1">
                {attendee.designation}
              </DialogDescription>
              <span
                className={cn(
                  "inline-flex mt-2 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                  role.className
                )}
              >
                {role.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        <section className="pt-2">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Why they&apos;re on this call
            </h4>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">{attendee.fitReason}</p>
        </section>
      </DialogContent>
    </Dialog>
  );
}

export function InternalAttendeesCard({
  attendees,
  embedded = false,
}: InternalAttendeesCardProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = attendees.find((a) => a.id === selectedId) ?? null;

  if (attendees.length === 0) return null;

  return (
    <>
      <BriefDetailCard
        title="Internal attendees"
        icon={Users}
        embedded={embedded}
        sourceInfo={{
          source: "Rules from lead context",
          detail:
            "The pod list is selected from account context such as industry, needs, tech stack, and delivery angle, so the right internal roles are prepared for the call.",
        }}
        headerExtra={
          <span className="text-xs text-muted-foreground shrink-0">{attendees.length} pod</span>
        }
      >
        <ul className="divide-y divide-border">
          {attendees.map((member) => {
            const role = ROLE_STYLES[member.role];
            return (
              <li
                key={member.id}
                className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                  {member.avatarUrl && (
                    <AvatarImage src={member.avatarUrl} alt={member.name} />
                  )}
                  <AvatarFallback
                    className={cn("text-[10px] font-semibold", role.className)}
                  >
                    {member.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{member.name}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        role.className
                      )}
                    >
                      {role.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{member.designation}</p>
                  <p className="text-xs text-foreground/80 leading-snug mt-1.5 line-clamp-2">
                    {member.fitReason}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 text-xs mt-0.5"
                  onClick={() => setSelectedId(member.id)}
                >
                  Details
                </Button>
              </li>
            );
          })}
        </ul>
      </BriefDetailCard>

      <InternalAttendeeDetailDialog
        attendee={selected}
        open={selectedId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </>
  );
}
