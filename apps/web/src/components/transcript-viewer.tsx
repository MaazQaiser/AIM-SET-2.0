"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { cn } from "@/lib/cn";
import { KeywordHighlight } from "@/components/live/keyword-highlight";
import { liveColumnHorizontalPadding } from "@/components/live/live-column-header";
import type { TranscriptEvent } from "@/types";

const sentimentToneClass: Record<string, string> = {
  positive:
    "bg-success/[0.06] hover:bg-success/[0.09] dark:bg-success/[0.08] dark:hover:bg-success/[0.12]",
  negative:
    "bg-destructive/[0.055] hover:bg-destructive/[0.085] dark:bg-destructive/[0.08] dark:hover:bg-destructive/[0.12]",
  neutral: "hover:bg-muted/50",
};

const sentimentEmoji: Record<string, string> = {
  positive: "😊",
  negative: "😟",
  neutral: "😐",
};

const roleColor: Record<string, string> = {
  ae: "text-primary",
  se: "text-success",
  designer: "text-warning-foreground",
  customer: "text-foreground",
};

interface TranscriptViewerProps {
  events: TranscriptEvent[];
  keywords?: string[];
  isLive?: boolean;
  liveActivityWindowMs?: number;
  onEventClick?: (event: TranscriptEvent) => void;
  className?: string;
}

export const TranscriptViewer = memo(function TranscriptViewer({
  events,
  keywords = [],
  isLive = false,
  liveActivityWindowMs = 2500,
  onEventClick,
  className,
}: TranscriptViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [showLiveCursor, setShowLiveCursor] = useState(false);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });
  const eventCount = events.length;
  const latestEventKey = useMemo(() => {
    const event = events[events.length - 1];
    if (!event) return "";
    return `${event.id}:${event.timestamp}:${event.text}`;
  }, [events]);

  // Auto-scroll to bottom when live
  useEffect(() => {
    if (isLive && eventCount > 0 && parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [eventCount, isLive]);

  useEffect(() => {
    if (!isLive || !latestEventKey) {
      setShowLiveCursor(false);
      return undefined;
    }

    setShowLiveCursor(true);
    const timeout = setTimeout(() => setShowLiveCursor(false), liveActivityWindowMs);
    return () => clearTimeout(timeout);
  }, [isLive, latestEventKey, liveActivityWindowMs]);

  return (
    <div
      ref={parentRef}
      className={cn("overflow-y-auto", className)}
      aria-live={isLive ? "polite" : "off"}
      aria-label="Call transcript"
    >
      <div
        style={{ height: `${virtualizer.getTotalSize()}px` }}
        className="relative w-full"
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const event = events[virtualRow.index];
          const isLastLive =
            isLive && showLiveCursor && virtualRow.index === events.length - 1;

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
              className="absolute left-0 top-0 w-full"
            >
              <button
                type="button"
                className={cn(
                  "group w-full text-left transition-colors",
                  isLive ? cn(liveColumnHorizontalPadding, "py-4") : "px-4 py-3",
                  event.sentiment ? sentimentToneClass[event.sentiment] : "hover:bg-muted/50",
                  onEventClick && "cursor-pointer"
                )}
                onClick={() => onEventClick?.(event)}
                disabled={!onEventClick}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ParticipantAvatar
                    name={event.speakerName}
                    kind={event.speakerRole === "customer" ? "external" : "internal"}
                    role={
                      event.speakerRole === "customer" || !event.speakerRole
                        ? "customer"
                        : event.speakerRole
                    }
                    size="xs"
                  />
                  <span
                    className={cn(
                      "type-label",
                      roleColor[event.speakerRole ?? "customer"]
                    )}
                  >
                    {event.speakerName}
                  </span>
                  <span className="type-caption text-muted-foreground">
                    {Math.floor(event.timestamp / 60)}:{String(event.timestamp % 60).padStart(2, "0")}
                  </span>
                  {event.sentiment && (
                    <span
                      className="type-label leading-none"
                      title={event.sentiment}
                      aria-label={`Sentiment: ${event.sentiment}`}
                    >
                      {sentimentEmoji[event.sentiment] ?? "😐"}
                    </span>
                  )}
                  {event.signalType === "discovery_anchor" && (
                    <span className="type-caption font-medium text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
                      Discovery anchor
                    </span>
                  )}
                </div>
                <p className="type-body text-foreground leading-relaxed">
                  <KeywordHighlight text={event.text} />
                  {isLastLive && (
                    <span className="inline-block w-2 h-3.5 ml-0.5 bg-foreground animate-cursor align-middle" />
                  )}
                </p>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

TranscriptViewer.displayName = "TranscriptViewer";
