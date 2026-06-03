"use client";

import { ClpNotificationBell } from "@/components/notifications/clp-notification-bell";

/** Top chrome: notifications aligned to the main content area (sidebar remains separate). */
export function TopBar() {
  return (
    <header className="flex shrink-0 items-center justify-end gap-2 px-4 py-2 sm:px-6">
      <ClpNotificationBell />
    </header>
  );
}
