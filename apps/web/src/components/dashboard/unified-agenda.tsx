"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";
import { Clock, ChevronRight } from "lucide-react";
import { GoogleMeetIcon } from "@/components/icons/google-meet-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { useCalls } from "@/lib/data/hooks";
import { callScheduleDate, upcomingOpenCalls } from "@/lib/dashboard/call-metrics";
import type { Call } from "@/types";
import { cn } from "@/lib/cn";

export type AgendaItemType = "call" | "calendar_event" | "ai_task";

export interface AgendaItem {
  id: string;
  type: AgendaItemType;
  title: string;
  subtitle?: string;
  scheduledAt: string;
  meetingUrl?: string;
  href?: string;
  status?: Call["status"];
}

/** Dashboard calls list: next open discovery calls; full schedule on /calls. */

function daySectionLabel(day: Date): string {
  if (isToday(day)) return "Today";
  if (isTomorrow(day)) return "Tomorrow";
  return format(day, "EEEE");
}

function MeetIconChip({ meetingUrl, isLive }: { meetingUrl?: string; isLive?: boolean }) {
  const chip = (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background",
        isLive && "ring-1 ring-destructive/30",
        meetingUrl && "hover:bg-muted/40"
      )}
    >
      <GoogleMeetIcon className="h-[18px] w-[18px]" />
    </div>
  );

  if (meetingUrl) {
    return (
      <a
        href={meetingUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join Google Meet"
        onClick={(e) => e.stopPropagation()}
      >
        {chip}
      </a>
    );
  }

  return chip;
}

function AgendaRow({ item, isLast }: { item: AgendaItem; isLast?: boolean }) {
  const time = format(new Date(item.scheduledAt), "h:mm a");

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-none border-0 bg-transparent px-0 py-2.5 transition-colors",
        !isLast && "border-b border-border",
        item.href && "cursor-pointer hover:opacity-80"
      )}
    >
      <MeetIconChip meetingUrl={item.meetingUrl} isLive={item.status === "live"} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate type-panel-title text-foreground">{item.title}</p>
          {item.status === "live" && (
            <Badge variant="live" className="h-4 type-caption">
              Live
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="truncate type-caption text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="type-mono text-muted-foreground">{time}</span>
      </div>
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }
  return content;
}

export function UnifiedAgenda() {
  const { data: calls = [] } = useCalls();

  const agendaItems = useMemo(() => {
    const list: AgendaItem[] = [];

    for (const call of upcomingOpenCalls(calls).slice(0, 8)) {
      const at = callScheduleDate(call);
      const displayAt = call.status === "live" ? new Date() : at;

      list.push({
        id: `call-${call.id}`,
        type: "call",
        title: call.accountName,
        subtitle: call.leadName
          ? `${call.leadName}${call.leadTitle ? ` · ${call.leadTitle}` : ""}`
          : undefined,
        scheduledAt: displayAt.toISOString(),
        href:
          call.status === "live"
            ? `/calls/${call.id}/live`
            : `/calls/${call.id}`,
        status: call.status,
        meetingUrl: call.meetingUrl,
      });
    }

    list.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    return list;
  }, [calls]);

  const grouped = useMemo(() => {
    const seenDays = new Map<string, Date>();
    for (const item of agendaItems) {
      const day = startOfDay(new Date(item.scheduledAt));
      seenDays.set(day.toISOString(), day);
    }

    return [...seenDays.values()]
      .sort((a, b) => a.getTime() - b.getTime())
      .map((day) => ({
        day,
        label: daySectionLabel(day),
        items: agendaItems.filter((i) =>
          isSameDay(new Date(i.scheduledAt), day)
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [agendaItems]);

  return (
    <Card className="flex h-[380px] flex-col">
      <CardHeader className="shrink-0 pb-3 pt-5 px-5">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          Upcoming calls
        </CardTitle>
        <p className="mt-1 type-caption text-muted-foreground">
          Next discovery calls
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-4">
          {grouped.length === 0 ? (
            <div className="space-y-2 rounded-lg border border-dashed px-4 py-10 text-center type-body-sm text-muted-foreground">
              <p>No upcoming calls scheduled.</p>
              <Link href="/calls" className="type-caption text-primary hover:underline">
                View full calendar
              </Link>
            </div>
          ) : (
            grouped.map(({ day, label, items }) => (
              <section key={day.toISOString()}>
                <h3 className="mb-2 type-label text-muted-foreground">
                  {label}
                  <span className="font-normal normal-case ml-2">
                    {format(day, "MMM d")}
                  </span>
                </h3>
                <div>
                  {items.map((item, index) => (
                    <AgendaRow
                      key={item.id}
                      item={item}
                      isLast={index === items.length - 1}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        <Button asChild variant="ghost" size="sm" className="mt-3 w-full shrink-0 gap-1 border-0 shadow-none">
          <Link href="/calls">
            View all upcoming calls
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
