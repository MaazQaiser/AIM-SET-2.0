"use client";

import { useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/cn";
import { KeywordHighlight } from "@/components/live/keyword-highlight";
import type { TranscriptEvent } from "@/types";

const sentimentColor: Record<string, string> = {
  positive: "border-l-success",
  negative: "border-l-destructive",
  neutral: "border-l-border",
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
  onEventClick?: (event: TranscriptEvent) => void;
  className?: string;
}

export function TranscriptViewer({
  events,
  keywords = [],
  isLive = false,
  onEventClick,
  className,
}: TranscriptViewerProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });
  const eventCount = events.length;

  // Auto-scroll to bottom when live
  useEffect(() => {
    if (isLive && eventCount > 0 && parentRef.current) {
      parentRef.current.scrollTop = parentRef.current.scrollHeight;
    }
  }, [eventCount, isLive]);

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
          const isLastLive = isLive && virtualRow.index === events.length - 1;

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
                  "group w-full text-left py-3 border-l-2 hover:bg-muted/50 transition-colors",
                  isLive ? "px-6" : "px-4",
                  event.sentiment ? sentimentColor[event.sentiment] : "border-l-border",
                  onEventClick && "cursor-pointer"
                )}
                onClick={() => onEventClick?.(event)}
                disabled={!onEventClick}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wide",
                      roleColor[event.speakerRole ?? "customer"]
                    )}
                  >
                    {event.speakerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(event.timestamp / 60)}:{String(event.timestamp % 60).padStart(2, "0")}
                  </span>
                  {event.sentiment && (
                    <span
                      className="text-xs leading-none"
                      title={event.sentiment}
                      aria-label={`Sentiment: ${event.sentiment}`}
                    >
                      {sentimentEmoji[event.sentiment] ?? "😐"}
                    </span>
                  )}
                  {event.signalType === "discovery_anchor" && (
                    <span className="text-[10px] font-medium text-success bg-success/10 border border-success/30 rounded px-1.5 py-0.5">
                      Discovery anchor
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed">
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
}
