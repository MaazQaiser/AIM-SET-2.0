"use client";

import { useState } from "react";
import { Linkedin, ChevronDown, ChevronUp, MessageCircle, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ClientAttendee, InfluenceLevel } from "@/lib/mock-data";

interface ClientAttendeesCardProps {
  attendees: ClientAttendee[];
}

const INFLUENCE_CONFIG: Record<InfluenceLevel, { label: string; className: string }> = {
  "decision-maker": { label: "Decision maker", className: "bg-blue-100 text-blue-700 border-blue-200" },
  "influencer":     { label: "Influencer",     className: "bg-purple-100 text-purple-700 border-purple-200" },
  "champion":       { label: "Champion",        className: "bg-green-100 text-green-700 border-green-200" },
  "blocker":        { label: "Blocker",          className: "bg-red-100 text-red-700 border-red-200" },
  "evaluator":      { label: "Evaluator",        className: "bg-orange-100 text-orange-700 border-orange-200" },
};

function formatRelativeDays(iso: string) {
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

function AttendeeRow({ attendee }: { attendee: ClientAttendee }) {
  const [expanded, setExpanded] = useState(false);
  const influence = INFLUENCE_CONFIG[attendee.influenceLevel];
  const initials = attendee.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Collapsed row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        {/* Avatar */}
        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
          {initials}
        </div>

        {/* Name + title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground">{attendee.name}</span>
            <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium", influence.className)}>
              {influence.label}
            </span>
            {attendee.linkedinUrl && (
              <a
                href={attendee.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label={`${attendee.name} LinkedIn`}
              >
                <Linkedin className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {attendee.title} · {attendee.department}
          </p>
        </div>

        {/* Last contacted */}
        <div className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground mr-1">
          {attendee.lastContactedAt ? (
            <>
              <Clock className="h-3 w-3" />
              {formatRelativeDays(attendee.lastContactedAt)}
            </>
          ) : (
            <span className="italic">First meeting</span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t bg-muted/20">
          {/* Background */}
          <div>
            <p className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground mb-1">Background</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{attendee.background}</p>
          </div>

          {/* Prior interaction note */}
          {attendee.priorInteractionNote && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 flex gap-2">
              <MessageCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-primary mb-0.5">Agent note</p>
                <p className="text-xs text-foreground/80 leading-relaxed">{attendee.priorInteractionNote}</p>
              </div>
            </div>
          )}

          {!attendee.lastContactedAt && (
            <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 text-xs text-warning font-medium">
              First time joining — no prior interaction data. Treat as a fresh introduction.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ClientAttendeesCard({ attendees }: ClientAttendeesCardProps) {
  const decisionMakers = attendees.filter((a) => a.influenceLevel === "decision-maker" || a.influenceLevel === "blocker");
  const others = attendees.filter((a) => a.influenceLevel !== "decision-maker" && a.influenceLevel !== "blocker");
  const sorted = [...decisionMakers, ...others];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Client attendees</CardTitle>
          <span className="text-xs text-muted-foreground">{attendees.length} people</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-1">
          {Object.entries(INFLUENCE_CONFIG).map(([key, cfg]) => {
            const count = attendees.filter((a) => a.influenceLevel === key).length;
            if (count === 0) return null;
            return (
              <span key={key} className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium gap-1", cfg.className)}>
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {sorted.map((attendee) => (
          <AttendeeRow key={attendee.id} attendee={attendee} />
        ))}
      </CardContent>
    </Card>
  );
}
