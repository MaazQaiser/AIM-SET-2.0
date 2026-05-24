"use client";

import { useState } from "react";
import { RefreshCw, Calendar, CheckSquare, Square, Loader2, Info } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { IntegrationCard } from "./integration-card";
import {
  useGoogleCalendarConnection,
  useGoogleCalendars,
  useSyncCalendar,
  useUpdateCalendarSelection,
  useDisconnectGoogleCalendar,
} from "@/hooks/use-google-calendar";
import { cn } from "@/lib/cn";
import type { GoogleCalendar } from "@/types/integrations";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function CalendarToggle({
  calendar,
  onToggle,
  disabled,
}: {
  calendar: GoogleCalendar;
  onToggle: (id: string, selected: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(calendar.id, !calendar.selected)}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2.5 w-full text-left rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {calendar.selected
        ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
        : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      <span
        className="h-2 w-2 rounded-full shrink-0"
        style={{ backgroundColor: calendar.backgroundColor ?? "#4285F4" }}
      />
      <span className="text-sm truncate">{calendar.summary}</span>
      {calendar.primary && (
        <span className="text-[10px] text-muted-foreground ml-auto">primary</span>
      )}
    </button>
  );
}

export function GoogleCalendarCard() {
  const { data: connection, isLoading: connectionLoading } = useGoogleCalendarConnection();
  const isConnected = connection?.isConnected ?? false;

  const { data: calendars = [], isLoading: calendarsLoading } = useGoogleCalendars(isConnected);
  const { mutate: sync, isPending: isSyncing, data: lastSyncResult } = useSyncCalendar();
  const { mutate: updateSelection, isPending: isUpdatingSelection } = useUpdateCalendarSelection();
  const { mutate: disconnect, isPending: isDisconnecting } = useDisconnectGoogleCalendar();

  const [localCalendars, setLocalCalendars] = useState<GoogleCalendar[]>([]);
  const displayCalendars = localCalendars.length > 0 ? localCalendars : calendars;

  function handleConnect() {
    window.location.href = "/api/integrations/google/auth";
  }

  function handleToggleCalendar(id: string, selected: boolean) {
    const updated = displayCalendars.map((c) =>
      c.id === id ? { ...c, selected } : c
    );
    setLocalCalendars(updated);
    updateSelection(updated.filter((c) => c.selected).map((c) => c.id));
  }

  const selectedCount = displayCalendars.filter((c) => c.selected).length;

  return (
    <IntegrationCard
      name="Google Calendar"
      description="Automatically import client calls from your calendar and pre-populate attendee details in pre-DC briefs."
      icon={<GoogleIcon />}
      status={
        isDisconnecting ? "syncing"
        : isSyncing       ? "syncing"
        : isConnected     ? "connected"
        : "disconnected"
      }
      connectedEmail={connection?.connectedEmail}
      lastSyncAt={lastSyncResult?.syncedAt ?? connection?.lastSyncAt}
      onConnect={handleConnect}
      onDisconnect={() => disconnect()}
      isLoading={connectionLoading || isDisconnecting}
    >
      {/* Calendar picker */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Calendars synced ({selectedCount}/{displayCalendars.length})
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Only events with external attendees (client calls) are imported. Internal meetings are ignored.
              </TooltipContent>
            </Tooltip>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 text-muted-foreground"
            onClick={() => sync()}
            disabled={isSyncing}
          >
            {isSyncing
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            {isSyncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>

        {calendarsLoading ? (
          <div className="space-y-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {displayCalendars.map((cal) => (
              <CalendarToggle
                key={cal.id}
                calendar={cal}
                onToggle={handleToggleCalendar}
                disabled={isUpdatingSelection}
              />
            ))}
          </div>
        )}

        {/* Last sync result */}
        {lastSyncResult && (
          <div className="rounded-md bg-success/5 border border-success/20 px-3 py-2 text-xs text-success">
            Sync complete — {lastSyncResult.callsFound} events found,{" "}
            {lastSyncResult.callsAdded} added, {lastSyncResult.callsUpdated} updated.
          </div>
        )}

        {/* Real-time note */}
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Real-time updates are enabled via Google Calendar push notifications.
          Your call list will update automatically when events are created or changed.
        </p>
      </div>
    </IntegrationCard>
  );
}
