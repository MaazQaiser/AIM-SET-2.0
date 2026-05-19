"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  addDays,
  addHours,
  format,
  isSameDay,
  isToday,
  isTomorrow,
  startOfDay,
} from "date-fns";
import { Phone, CalendarDays, Sparkles, Video, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCalls } from "@/lib/data/hooks";
import { useCalendarEvents, useGoogleCalendarConnection } from "@/hooks/use-google-calendar";
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

/** Agenda widget only lists today and tomorrow; full schedule is on /calls. */
const AGENDA_DAY_COUNT = 2;

function dayLabel(day: Date): string {
  if (isToday(day)) return "Today";
  if (isTomorrow(day)) return "Tomorrow";
  return format(day, "EEEE");
}

function formatPktSchedule(call: Call): string {
  if (call.discoveryCallTimePkt) {
    return call.discoveryCallTimePkt;
  }
  return format(new Date(call.scheduledAt), "h:mm a");
}

function AgendaRow({ item }: { item: AgendaItem }) {
  const time = format(new Date(item.scheduledAt), "h:mm a");
  const Icon =
    item.type === "call"
      ? Phone
      : item.type === "calendar_event"
        ? CalendarDays
        : Sparkles;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        item.type === "ai_task"
          ? "border-dashed border-primary/30 bg-primary/5"
          : "bg-card hover:bg-muted/40",
        item.href && "cursor-pointer"
      )}
    >
      <div className="w-12 shrink-0 text-right">
        <span className="text-xs font-mono text-muted-foreground">{time}</span>
      </div>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          item.type === "call" && item.status === "live"
            ? "bg-destructive/10 text-destructive"
            : item.type === "ai_task"
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
          {item.status === "live" && (
            <Badge variant="live" className="text-[10px] h-4">
              Live
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{item.subtitle}</p>
        )}
      </div>
      {item.meetingUrl && (
        <a
          href={item.meetingUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <Button size="sm" className="h-7 text-xs gap-1 shrink-0">
            <Video className="h-3 w-3" />
            Join
          </Button>
        </a>
      )}
    </div>
  );

  if (item.href) {
    return <Link href={item.href}>{content}</Link>;
  }
  return content;
}

export function UnifiedAgenda() {
  const { data: calls = [] } = useCalls();
  const { data: connection } = useGoogleCalendarConnection();
  const { data: calendarData } = useCalendarEvents(
    AGENDA_DAY_COUNT,
    connection?.isConnected ?? false
  );

  const items = useMemo(() => {
    const list: AgendaItem[] = [];
    const now = new Date();
    const horizon = addDays(startOfDay(now), AGENDA_DAY_COUNT);

    for (const call of calls) {
      const at = new Date(call.scheduledAt);
      if (at < startOfDay(now) || at >= horizon) continue;
      if (call.status === "completed" || call.status === "no-show") continue;

      list.push({
        id: `call-${call.id}`,
        type: "call",
        title: call.accountName,
        subtitle: call.leadName
          ? `${call.leadName}${call.leadTitle ? ` · ${call.leadTitle}` : ""} · ${formatPktSchedule(call)}`
          : formatPktSchedule(call),
        scheduledAt: call.scheduledAt,
        href:
          call.status === "live"
            ? `/calls/${call.id}/live`
            : `/calls/${call.id}`,
        status: call.status,
      });

      const hoursUntil = (at.getTime() - now.getTime()) / 3_600_000;
      if (
        !call.briefReady &&
        hoursUntil > 0 &&
        hoursUntil <= 4 &&
        (call.status === "upcoming" || call.status === "live")
      ) {
        const briefAt = addHours(at, -4);
        if (briefAt > now) {
          list.push({
            id: `ai-brief-${call.id}`,
            type: "ai_task",
            title: `Brief generates for ${call.accountName}`,
            subtitle: "Content Agent · T-4h before call",
            scheduledAt: briefAt.toISOString(),
            href: `/calls/${call.id}`,
          });
        }
      }
    }

    if (connection?.isConnected && calendarData?.calls) {
      for (const ev of calendarData.calls) {
        const at = new Date(ev.scheduledAt);
        if (at < startOfDay(now) || at >= horizon) continue;
        const duplicate = list.some(
          (i) =>
            i.type === "call" &&
            isSameDay(new Date(i.scheduledAt), at) &&
            i.title.toLowerCase() === ev.accountName.toLowerCase()
        );
        if (duplicate) continue;

        list.push({
          id: `gcal-${ev.eventId}`,
          type: "calendar_event",
          title: ev.title,
          subtitle: ev.attendees
            .filter((a) => a.isExternal)
            .map((a) => a.name ?? a.email)
            .slice(0, 2)
            .join(", "),
          scheduledAt: ev.scheduledAt,
          meetingUrl: ev.meetingUrl,
        });
      }
    }

    list.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    return list;
  }, [calls, calendarData, connection?.isConnected]);

  const grouped = useMemo(() => {
    const days = Array.from({ length: AGENDA_DAY_COUNT }, (_, i) =>
      addDays(startOfDay(new Date()), i)
    );
    return days
      .map((day) => ({
        day,
        label: dayLabel(day),
        items: items.filter((i) => isSameDay(new Date(i.scheduledAt), day)),
      }))
      .filter((g) => g.items.length > 0);
  }, [items]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Link
            href="/calls"
            aria-label="View full calendar"
            title="View full calendar"
            className="shrink-0 rounded-md p-1 -m-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <span className="sr-only">View full calendar</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-6"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25"
              />
            </svg>
          </Link>
          <div className="min-w-0 flex-1 space-y-0.5">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              Your agenda
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Calls, calendar, and AI prep — today and tomorrow
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Nothing scheduled for today or tomorrow.
          </div>
        ) : (
          grouped.map(({ day, label, items: dayItems }) => (
            <section key={day.toISOString()}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {label}
                <span className="font-normal normal-case ml-2">
                  {format(day, "MMM d")}
                </span>
              </h3>
              <div className="space-y-2">
                {dayItems.map((item) => (
                  <AgendaRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
