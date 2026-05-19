"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CalendarMappedCall, GoogleCalendar, CalendarSyncState } from "@/types/integrations";

// ── Query keys ──────────────────────────────────────────────────────────────
export const CALENDAR_KEYS = {
  connection: ["integrations", "google", "connection"] as const,
  calendars:  ["integrations", "google", "calendars"]  as const,
  events:     (days: number) => ["integrations", "google", "events", days] as const,
};

// ── Connection status ────────────────────────────────────────────────────────
/**
 * Returns whether Google Calendar is connected.
 * In production: GET /api/integrations/google/connection
 */
export function useGoogleCalendarConnection() {
  return useQuery({
    queryKey: CALENDAR_KEYS.connection,
    queryFn: async (): Promise<{ isConnected: boolean; connectedEmail?: string; lastSyncAt?: string }> => {
      // ── Mock: simulate connected state ─────────────────────────────────
      // Replace with: const res = await fetch("/api/integrations/google/connection");
      return {
        isConnected:   false,   // flip to true to see connected UI
        connectedEmail: undefined,
        lastSyncAt:    undefined,
      };
    },
    staleTime: 60_000,
  });
}

// ── Calendars list ───────────────────────────────────────────────────────────
export function useGoogleCalendars(enabled = true) {
  return useQuery({
    queryKey: CALENDAR_KEYS.calendars,
    enabled,
    queryFn: async (): Promise<GoogleCalendar[]> => {
      const res = await fetch("/api/integrations/google/calendars");
      if (!res.ok) throw new Error("Failed to fetch calendars");
      const data = await res.json() as { calendars: GoogleCalendar[] };
      return data.calendars;
    },
    staleTime: 5 * 60_000,
  });
}

// ── Upcoming events mapped to CalendarMappedCall ─────────────────────────────
export function useCalendarEvents(days = 14, enabled = true) {
  return useQuery({
    queryKey: CALENDAR_KEYS.events(days),
    enabled,
    queryFn: async (): Promise<{ calls: CalendarMappedCall[]; syncedAt: string }> => {
      const res = await fetch(`/api/integrations/google/events?days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch calendar events");
      return res.json() as Promise<{ calls: CalendarMappedCall[]; syncedAt: string }>;
    },
    staleTime: 2 * 60_000,      // re-fetch every 2 minutes
    refetchInterval: 5 * 60_000, // background poll every 5 minutes
  });
}

// ── Calendar selection update ─────────────────────────────────────────────────
export function useUpdateCalendarSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (selectedIds: string[]) => {
      const res = await fetch("/api/integrations/google/calendars", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedIds }),
      });
      if (!res.ok) throw new Error("Failed to update calendar selection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CALENDAR_KEYS.calendars });
      queryClient.invalidateQueries({ queryKey: ["integrations", "google", "events"] });
    },
  });
}

// ── Manual sync ───────────────────────────────────────────────────────────────
export function useSyncCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/sync", { method: "POST" });
      if (!res.ok) throw new Error("Sync failed");
      return res.json() as Promise<{
        syncedAt: string;
        callsFound: number;
        callsAdded: number;
        callsUpdated: number;
      }>;
    },
    onSuccess: () => {
      // Invalidate all calendar-related queries + the calls list
      queryClient.invalidateQueries({ queryKey: ["integrations", "google"] });
      queryClient.invalidateQueries({ queryKey: ["calls"] });
    },
  });
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export function useDisconnectGoogleCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations/google/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed");
      return res.json();
    },
    onSuccess: () => {
      // Wipe all calendar query cache
      queryClient.removeQueries({ queryKey: ["integrations", "google"] });
    },
  });
}
