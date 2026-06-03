"use client";

import Link from "next/link";
import { Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { useLandingPageActivity } from "@/lib/data/clp-hooks";
import { formatDistanceToNow } from "date-fns";

interface PostDcClpActivityCardProps {
  callId: string;
  enabled?: boolean;
}

export function PostDcClpActivityCard({ callId, enabled = true }: PostDcClpActivityCardProps) {
  const { data } = useLandingPageActivity(callId);
  const events = (data?.events ?? []).slice(0, 5);

  if (!enabled || events.length === 0) return null;

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Recent visitor activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="text-xs text-muted-foreground space-y-1.5">
          {events.map((ev) => (
            <li key={ev.id}>
              <span className="text-foreground">{ev.eventType.replace(/_/g, " ")}</span>
              {" · "}
              {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
            </li>
          ))}
        </ul>
        <Link
          href={`/calls/${callId}/landing-page/activity`}
          className="text-xs text-primary hover:underline"
        >
          View all activity
        </Link>
      </CardContent>
    </Card>
  );
}
