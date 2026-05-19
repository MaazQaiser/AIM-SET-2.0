"use client";

import { useState } from "react";
import { Phone, Monitor, Mail, FileText, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users, Clock } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ClientInteraction, SentimentTrend } from "@/lib/mock-data";

interface ClientHistoryCardProps {
  interactions: ClientInteraction[];
}

const TYPE_CONFIG: Record<ClientInteraction["type"], { icon: React.ElementType; label: string; color: string }> = {
  "discovery-call": { icon: Phone,      label: "Discovery call", color: "bg-blue-100 text-blue-700 border-blue-200" },
  "demo":           { icon: Monitor,    label: "Demo",           color: "bg-purple-100 text-purple-700 border-purple-200" },
  "follow-up":      { icon: Phone,      label: "Follow-up",      color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  "email":          { icon: Mail,       label: "Email",          color: "bg-muted text-muted-foreground border-border" },
  "proposal":       { icon: FileText,   label: "Proposal",       color: "bg-orange-100 text-orange-700 border-orange-200" },
  "no-show":        { icon: Phone,      label: "No show",        color: "bg-red-100 text-red-700 border-red-200" },
};

const SENTIMENT_CONFIG: Record<SentimentTrend, { icon: React.ElementType; label: string; color: string }> = {
  positive:  { icon: TrendingUp,   label: "Positive",  color: "text-success" },
  improving: { icon: TrendingUp,   label: "Improving", color: "text-success" },
  neutral:   { icon: Minus,        label: "Neutral",   color: "text-muted-foreground" },
  declining: { icon: TrendingDown, label: "Declining", color: "text-warning" },
  negative:  { icon: TrendingDown, label: "Negative",  color: "text-destructive" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysAgo(iso: string) {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d}d ago`;
}

function InteractionRow({ interaction, isFirst }: { interaction: ClientInteraction; isFirst: boolean }) {
  const [expanded, setExpanded] = useState(isFirst);
  const typeCfg = TYPE_CONFIG[interaction.type];
  const sentimentCfg = SENTIMENT_CONFIG[interaction.sentimentTrend];
  const TypeIcon = typeCfg.icon;
  const SentimentIcon = sentimentCfg.icon;

  return (
    <div className="relative pl-6">
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-0 top-3 h-3 w-3 rounded-full border-2 border-background",
        isFirst ? "bg-primary" : "bg-muted-foreground/40"
      )} />

      <button
        className="w-full text-left"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-2 pb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium", typeCfg.color)}>
              <TypeIcon className="h-3 w-3" />
              {typeCfg.label}
            </span>
            <span className="text-xs text-muted-foreground">{formatDate(interaction.date)}</span>
            <span className="text-[10px] text-muted-foreground">({daysAgo(interaction.date)})</span>
            {interaction.durationMinutes && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {interaction.durationMinutes}m
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", sentimentCfg.color)}>
              <SentimentIcon className="h-3.5 w-3.5" />
              {sentimentCfg.label}
            </span>
            {expanded
              ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </div>
        </div>

        {/* Outcome — always visible */}
        <p className="text-sm font-medium text-foreground leading-snug">{interaction.outcome}</p>
      </button>

      {/* Key moments — expanded */}
      {expanded && (
        <div className="mt-2 mb-4 space-y-2">
          {/* Attendees */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>{interaction.attendees.join(" · ")}</span>
          </div>

          {/* Key moments */}
          <div className="rounded-md bg-muted/40 px-3 py-2 space-y-1.5">
            {interaction.keyMoments.map((moment, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-foreground/80">
                <span className="text-primary font-bold shrink-0 mt-0.5">·</span>
                <span>{moment}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!expanded && <div className="mb-4" />}
    </div>
  );
}

export function ClientHistoryCard({ interactions }: ClientHistoryCardProps) {
  if (interactions.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Client interaction history</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">No prior interactions recorded.</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...interactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Client interaction history</CardTitle>
          <span className="text-xs text-muted-foreground">{interactions.length} interactions</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Timeline */}
        <div className="relative border-l border-dashed border-border ml-1.5">
          {sorted.map((interaction, i) => (
            <InteractionRow key={interaction.id} interaction={interaction} isFirst={i === 0} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
