"use client";

import { useMemo } from "react";
import Link from "next/link";
import { addDays, format, isSameDay, isToday, isTomorrow, startOfDay } from "date-fns";
import { Clock, ChevronRight } from "lucide-react";
import { GoogleMeetIcon } from "@/components/icons/google-meet-icon";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Button } from "@dc-copilot/ui/components/button";
import { Badge } from "@dc-copilot/ui/components/badge";
import { useCalls } from "@/lib/data/hooks";
import { parseDiscoveryDateTime } from "@/lib/dc-notes/parse-discovery";
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

/** Dashboard agenda: today and tomorrow; full schedule on /calls. */

function isAgendaDay(at: Date): boolean {
  return isToday(at) || isTomorrow(at);
}

function daySectionLabel(day: Date): string {
  if (isToday(day)) return "Today";
  if (isTomorrow(day)) return "Tomorrow";
  return format(day, "EEEE");
}

function callAgendaDate(call: Call): Date {
  if (call.discoveryCallDatePkt?.trim()) {
    const parsed = parseDiscoveryDateTime(
      call.discoveryCallDatePkt,
      call.discoveryCallTimePkt ?? ""
    );
    if (parsed) return new Date(parsed);
  }
  return new Date(call.scheduledAt);
}

function shouldIncludeCall(call: Call): boolean {
  if (call.status === "completed" || call.status === "no-show") return false;
  if (call.status === "live") return true;
  const at = callAgendaDate(call);
  if (!Number.isFinite(at.getTime())) return false;
  return isAgendaDay(at);
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
          <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
          {item.status === "live" && (
            <Badge variant="live" className="h-4 text-[10px]">
              Live
            </Badge>
          )}
        </div>
        {item.subtitle && (
          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="text-xs font-mono text-muted-foreground">{time}</span>
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

    for (const call of calls) {
      if (!shouldIncludeCall(call)) continue;
      const at = callAgendaDate(call);
      const displayAt =
        call.status === "live" && !isAgendaDay(at) ? new Date() : at;

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
    const days = [startOfDay(new Date()), startOfDay(addDays(new Date(), 1))];
    return days
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
        <CardTitle className="!text-[24px] !leading-[1.2] flex items-center gap-2">
          <Clock className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          Your agenda
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Today and tomorrow — discovery calls
        </p>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 space-y-4">
          {grouped.length === 0 ? (
            <div className="rounded-lg border border-dashed py-10 px-4 text-center text-sm text-muted-foreground space-y-2">
              <p>Nothing scheduled for today or tomorrow.</p>
              <Link href="/calls" className="text-xs text-primary hover:underline">
                View full calendar
              </Link>
            </div>
          ) : (
            grouped.map(({ day, label, items }) => (
              <section key={day.toISOString()}>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
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
