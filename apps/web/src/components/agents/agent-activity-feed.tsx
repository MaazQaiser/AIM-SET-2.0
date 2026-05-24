"use client";

import { useEffect, useRef } from "react";
import {
  MessageSquare, CheckCheck, X, FileText, Upload,
  Star, Mail, Database, AlertTriangle, Zap, RefreshCw, XCircle,
} from "lucide-react";
import { ScrollArea } from "@dc-copilot/ui/components/scroll-area";
import type { ActivityEvent, ActivityEventType } from "@/types/agents";
import { cn } from "@/lib/cn";

interface AgentActivityFeedProps {
  events: ActivityEvent[];
  maxHeight?: string;
  className?: string;
}

const EVENT_CONFIG: Record<
  ActivityEventType,
  { icon: React.ElementType; label: string; variant: string }
> = {
  nudge_sent:        { icon: Zap,         label: "Nudge sent",       variant: "bg-blue-50 text-blue-700 border-blue-100" },
  nudge_accepted:    { icon: CheckCheck,  label: "Nudge accepted",   variant: "bg-green-50 text-green-700 border-green-100" },
  nudge_dismissed:   { icon: X,           label: "Nudge dismissed",  variant: "bg-muted text-muted-foreground border-border" },
  bot_chat_answered: { icon: MessageSquare, label: "Bot chat",       variant: "bg-blue-50 text-blue-700 border-blue-100" },
  brief_generated:   { icon: FileText,    label: "Brief generated",  variant: "bg-purple-50 text-purple-700 border-purple-100" },
  asset_ingested:    { icon: Upload,      label: "Asset ingested",   variant: "bg-green-50 text-green-700 border-green-100" },
  scorecard_produced:{ icon: Star,        label: "Scorecard",        variant: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  email_drafted:     { icon: Mail,        label: "Email drafted",    variant: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  crm_task_created:  { icon: Database,    label: "CRM task",         variant: "bg-green-50 text-green-700 border-green-100" },
  cost_cap_warning:  { icon: AlertTriangle, label: "Cost warning",   variant: "bg-orange-50 text-orange-700 border-orange-100" },
  model_fallback:    { icon: RefreshCw,   label: "Model fallback",   variant: "bg-yellow-50 text-yellow-700 border-yellow-100" },
  run_failed:        { icon: XCircle,     label: "Run failed",       variant: "bg-red-50 text-red-700 border-red-100" },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AgentActivityFeed({ events, maxHeight = "400px", className }: AgentActivityFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventCount = events.length;

  useEffect(() => {
    if (eventCount > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [eventCount]);

  if (eventCount === 0) {
    return (
      <div className={cn("flex items-center justify-center py-12 text-muted-foreground text-sm", className)}>
        No activity yet
      </div>
    );
  }

  return (
    <ScrollArea className={cn("rounded-md border", className)} style={{ maxHeight }}>
      <div className="divide-y">
        {events.map((ev) => {
          const cfg = EVENT_CONFIG[ev.event_type] ?? {
            icon: Zap, label: ev.event_type, variant: "bg-muted text-muted-foreground",
          };
          const Icon = cfg.icon;

          return (
            <div key={ev.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className={cn("mt-0.5 rounded-full border p-1", cfg.variant)}>
                <Icon className="h-3 w-3" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{ev.description}</p>
                {ev.cost_usd !== undefined && ev.cost_usd > 0 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    ${ev.cost_usd.toFixed(4)}
                  </p>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                {formatTime(ev.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
