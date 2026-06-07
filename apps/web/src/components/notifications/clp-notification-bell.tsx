"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dc-copilot/ui/components/popover";
import { useClpNotifications } from "@/lib/data/clp-hooks";
import { formatDistanceToNow } from "date-fns";

export function ClpNotificationBell() {
  const { data } = useClpNotifications(true);
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.readAt);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread.length > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-3 py-2 border-b type-body font-medium">Landing page activity</div>
        <ul className="max-h-72 overflow-y-auto">
          {unread.length === 0 ? (
            <li className="px-3 py-6 type-caption text-muted-foreground text-center">No new activity</li>
          ) : (
            unread.slice(0, 10).map((n) => (
              <li key={n.id} className="border-b last:border-0">
                <Link
                  href={`/calls/${n.callId}/landing-page/activity`}
                  className="block px-3 py-2 type-label hover:bg-muted/50"
                >
                  <p className="text-foreground">{n.summary}</p>
                  <p className="text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </Link>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
