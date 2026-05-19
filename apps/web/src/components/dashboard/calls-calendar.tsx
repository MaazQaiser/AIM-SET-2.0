"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  format,
  isSameDay,
  startOfDay,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  isToday,
  setHours,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, Radio } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

const HOUR_START = 8;
const HOUR_END = 18;

function sortByTime(calls: Call[]) {
  return [...calls].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
  );
}

function formatPktSchedule(call: Call): string {
  if (call.discoveryCallDatePkt && call.discoveryCallTimePkt) {
    return `${call.discoveryCallTimePkt} PKT · ${call.discoveryCallDatePkt}`;
  }
  return format(new Date(call.scheduledAt), "h:mm a");
}

interface CallsCalendarProps {
  calls: Call[];
  className?: string;
}

function CompactCallBlock({ call }: { call: Call }) {
  const timeLabel = formatPktSchedule(call);
  const href =
    call.status === "live"
      ? `/calls/${call.id}/live`
      : call.briefReady
        ? `/calls/${call.id}`
        : `/calls/${call.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-lg border px-3 py-2 text-left transition-colors hover:bg-muted/60",
        call.status === "live" && "border-destructive/40 bg-destructive/5",
        call.status === "upcoming" && "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-mono text-muted-foreground">{timeLabel}</span>
        {call.status === "live" ? (
          <Badge variant="live" className="text-[10px] h-5">
            Live
          </Badge>
        ) : call.briefReady ? (
          <FileText className="h-3 w-3 text-primary shrink-0" aria-label="Brief ready" />
        ) : null}
      </div>
      <p className="text-sm font-medium text-foreground truncate mt-0.5">{call.accountName}</p>
      {call.annualRevenue && (
        <p className="text-[10px] font-medium text-primary/90">{call.annualRevenue} revenue</p>
      )}
      {call.leadName && (
        <p className="text-[10px] text-muted-foreground truncate">{call.leadName}</p>
      )}
    </Link>
  );
}

function TodayView({ calls, day }: { calls: Call[]; day: Date }) {
  const dayCalls = useMemo(
    () => sortByTime(calls.filter((c) => isSameDay(new Date(c.scheduledAt), day))),
    [calls, day]
  );

  const slots = useMemo(() => {
    const byHour = new Map<number, Call[]>();
    for (const call of dayCalls) {
      const hour = new Date(call.scheduledAt).getHours();
      const bucket = hour >= HOUR_START && hour <= HOUR_END ? hour : HOUR_START;
      if (!byHour.has(bucket)) byHour.set(bucket, []);
      byHour.get(bucket)!.push(call);
    }
    return Array.from(byHour.entries())
      .map(([hour, list]) => ({ hour, calls: list }))
      .sort((a, b) => a.hour - b.hour);
  }, [dayCalls]);

  if (dayCalls.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center rounded-xl border border-dashed border-border bg-muted/20">
        <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No calls scheduled</p>
        <p className="text-xs text-muted-foreground mt-1">
          {isToday(day) ? "Your calendar is clear for today." : format(day, "EEEE, MMM d")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {slots.map(({ hour, calls: hourCalls }) => (
        <div key={hour} className="grid grid-cols-[56px_1fr] gap-3 min-h-[52px]">
          <div className="pt-2 text-xs font-mono text-muted-foreground text-right">
            {format(setHours(startOfDay(day), hour), "h a")}
          </div>
          <div className="space-y-2 border-l border-border pl-3 pb-2">
            {hourCalls.map((call) => (
              <CompactCallBlock key={call.id} call={call} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function WeekView({ calls, weekStart }: { calls: Call[]; weekStart: Date }) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const callsByDay = useMemo(() => {
    const map = new Map<string, Call[]>();
    for (const day of days) {
      map.set(format(day, "yyyy-MM-dd"), []);
    }
    for (const call of calls) {
      const d = new Date(call.scheduledAt);
      const key = format(d, "yyyy-MM-dd");
      if (map.has(key)) map.get(key)!.push(call);
    }
    for (const key of map.keys()) {
      map.set(key, sortByTime(map.get(key)!));
    }
    return map;
  }, [calls, days]);

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="grid grid-cols-7 gap-2 min-h-[320px] min-w-[640px]">
      {days.map((day) => {
        const key = format(day, "yyyy-MM-dd");
        const dayCalls = callsByDay.get(key) ?? [];
        const today = isToday(day);

        return (
          <div
            key={key}
            className={cn(
              "flex flex-col rounded-xl border min-h-[280px] overflow-hidden",
              today ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card"
            )}
          >
            <div
              className={cn(
                "px-2 py-2 border-b text-center shrink-0",
                today ? "border-primary/20 bg-primary/10" : "border-border bg-muted/30"
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {format(day, "EEE")}
              </p>
              <p className={cn("text-lg font-semibold tabular-nums", today && "text-primary")}>
                {format(day, "d")}
              </p>
            </div>
            <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[240px]">
              {dayCalls.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-6 px-1">No calls</p>
              ) : (
                dayCalls.map((call) => (
                  <WeekCallChip key={call.id} call={call} />
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function WeekCallChip({ call }: { call: Call }) {
  const time = format(new Date(call.scheduledAt), "h:mm a");
  const href = call.status === "live" ? `/calls/${call.id}/live` : `/calls/${call.id}`;

  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1.5 text-left text-[11px] leading-tight border transition-colors hover:bg-muted/80",
        call.status === "live"
          ? "border-destructive/30 bg-destructive/10"
          : "border-border/80 bg-background"
      )}
    >
      <span className="font-mono text-muted-foreground">{formatPktSchedule(call)}</span>
      <p className="font-medium text-foreground truncate mt-0.5">{call.accountName}</p>
      {call.annualRevenue && (
        <p className="text-[9px] text-primary/90 font-medium">{call.annualRevenue}</p>
      )}
      {call.status === "live" && (
        <span className="inline-flex items-center gap-0.5 text-destructive mt-0.5">
          <Radio className="h-2.5 w-2.5" />
          Live
        </span>
      )}
    </Link>
  );
}

export function CallsCalendar({ calls, className }: CallsCalendarProps) {
  const allCalls = useMemo(() => sortByTime(calls), [calls]);

  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  useEffect(() => {
    if (allCalls.length === 0) return;
    const today = startOfDay(new Date());
    const hasThisWeek = allCalls.some((c) =>
      isWithinInterval(new Date(c.scheduledAt), {
        start: startOfWeek(today, { weekStartsOn: 1 }),
        end: endOfWeek(today, { weekStartsOn: 1 }),
      })
    );
    if (!hasThisWeek) {
      const anchor = new Date(allCalls[0].scheduledAt);
      setWeekAnchor(startOfWeek(anchor, { weekStartsOn: 1 }));
    }
  }, [allCalls]);

  const weekEnd = endOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekCalls = useMemo(
    () =>
      allCalls.filter((c) =>
        isWithinInterval(new Date(c.scheduledAt), {
          start: startOfDay(weekAnchor),
          end: weekEnd,
        })
      ),
    [allCalls, weekAnchor, weekEnd]
  );

  const today = startOfDay(new Date());
  const todayCount = allCalls.filter((c) => isSameDay(new Date(c.scheduledAt), today)).length;
  const weekCount = weekCalls.length;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        <Tabs defaultValue="today" className="w-full">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 pt-4 pb-2 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Call schedule
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pre-DC leads by Discovery Call Date (PKT) from your import
              </p>
            </div>
            <TabsList className="h-9">
              <TabsTrigger value="today" className="text-xs gap-1.5">
                Today
                {todayCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[10px] font-medium text-primary">
                    {todayCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="week" className="text-xs gap-1.5">
                Week
                {weekCount > 0 && (
                  <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0 text-[10px] font-medium">
                    {weekCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="today" className="m-0 p-4">
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {format(today, "EEEE, MMMM d")}
              {isToday(today) && (
                <Badge variant="outline" className="text-[10px] h-5">
                  Today
                </Badge>
              )}
            </div>
            <TodayView calls={allCalls} day={today} />
          </TabsContent>

          <TabsContent value="week" className="m-0 p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                {format(weekAnchor, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekAnchor((w) => addDays(w, -7))}
                  aria-label="Previous week"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setWeekAnchor(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                >
                  This week
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setWeekAnchor((w) => addDays(w, 7))}
                  aria-label="Next week"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <WeekView calls={weekCalls} weekStart={weekAnchor} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
