"use client";
import { Video, Users, Clock, Calendar } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { useCalendarEvents } from "@/hooks/use-google-calendar";
import { format } from "date-fns";
import type { CalendarMappedCall } from "@/types/integrations";
import { cn } from "@/lib/cn";

interface CalendarEventListProps {
  className?: string;
}

function EventRow({ call }: { call: CalendarMappedCall }) {
  const start = new Date(call.scheduledAt);
  const externalAttendees = call.attendees.filter((a) => a.isExternal);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      {/* Date block */}
      <div className="shrink-0 w-12 text-center rounded-md bg-primary/10 py-1">
        <p className="type-caption font-medium text-primary">
          {format(start, "MMM")}
        </p>
        <p className="text-lg font-bold text-primary leading-none">
          {format(start, "d")}
        </p>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="type-panel-title text-foreground truncate">{call.accountName}</p>
            <p className="type-caption text-muted-foreground truncate">{call.title}</p>
          </div>
          {call.meetingUrl && (
            <a
              href={call.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button size="sm" className="h-6 type-label gap-1 bg-success hover:bg-success/90 text-white">
                <Video className="h-3 w-3" />
                Join
              </Button>
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 type-caption text-muted-foreground">
            <Clock className="h-3 w-3" />
            {format(start, "h:mm a")} · {call.durationMinutes}m
          </span>
          <span className="inline-flex items-center gap-1 type-caption text-muted-foreground">
            <Users className="h-3 w-3" />
            {externalAttendees.length} client{externalAttendees.length !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1 type-caption text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/50" />
            Google Calendar
          </span>
        </div>

        {/* External attendees */}
        {externalAttendees.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {externalAttendees.slice(0, 3).map((a) => (
              <span
                key={a.email}
                className={cn(
                  "inline-flex items-center rounded-full border px-1.5 py-0.5 type-caption",
                  a.responseStatus === "accepted"    && "border-success/30 bg-success/5 text-success",
                  a.responseStatus === "tentative"   && "border-warning/30 bg-warning/5 text-warning",
                  a.responseStatus === "needsAction" && "border-border bg-muted text-muted-foreground",
                  a.responseStatus === "declined"    && "border-destructive/30 bg-destructive/5 text-destructive line-through",
                )}
              >
                {a.name ?? a.email.split("@")[0]}
              </span>
            ))}
            {externalAttendees.length > 3 && (
              <span className="type-caption text-muted-foreground">+{externalAttendees.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarEventList({ className }: CalendarEventListProps) {
  const { data, isLoading, error } = useCalendarEvents(14, true);
  const calls = data?.calls ?? [];

  if (isLoading) {
    return (
      <div className={cn("divide-y rounded-md border", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <Skeleton className="h-12 w-12 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 type-body text-destructive", className)}>
        Failed to load calendar events. Try reconnecting Google Calendar.
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <EmptyState
        icon={Calendar}
        title="No upcoming client calls"
        description="Events with external attendees will appear here once your calendar is connected."
        className={className}
      />
    );
  }

  return (
    <div className={cn("divide-y rounded-md border overflow-hidden", className)}>
      {calls.map((call) => (
        <EventRow key={call.eventId} call={call} />
      ))}
      {data?.syncedAt && (
        <div className="px-4 py-2 type-caption text-muted-foreground bg-muted/20">
          Synced from Google Calendar · {new Date(data.syncedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
