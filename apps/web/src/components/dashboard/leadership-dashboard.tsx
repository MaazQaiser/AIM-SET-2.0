"use client";

import Link from "next/link";
import { Radio, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { useCoachingCandidates, useCalls } from "@/lib/data/hooks";

export function LeadershipDashboardExtras() {
  const { data: candidates } = useCoachingCandidates();
  const { data: calls } = useCalls();
  const liveCalls = calls?.filter((c) => c.status === "live") ?? [];

  return (
    <>
      <section className="space-y-3">
        <h2 className="type-title">This week&apos;s coaching candidates</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {candidates?.map((c) => (
            <Card key={c.aeId}>
              <CardHeader className="pb-2">
                <CardTitle>
                  <Link href={`/coaching/${c.aeId}`} className="hover:text-primary">
                    {c.aeName}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="type-caption text-muted-foreground italic">{c.pattern}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {liveCalls.length > 0 && (
        <section className="space-y-2">
          <h2 className="type-title flex items-center gap-2">
            <Radio className="h-4 w-4 text-destructive animate-pulse" />
            Live calls
          </h2>
          <div className="flex flex-wrap gap-2">
            {liveCalls.map((call) => (
              <Link key={call.id} href={`/calls/${call.id}/live`}>
                <Badge variant="live" className="cursor-pointer">
                  {call.accountName}
                </Badge>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function AeCoachingBanner() {
  return (
    <Link
      href="/coaching/ae-sarah"
      className="app-card block px-4 py-3 transition-colors hover:bg-muted/30"
    >
      <div className="flex items-center gap-2 type-body-sm font-medium text-foreground">
        <Users className="h-4 w-4" />
        Coaching context for your 1:1 with Marcus tomorrow
      </div>
      <p className="type-caption text-muted-foreground mt-1">
        Review transcript moments before your sync — patterns, not verdicts.
      </p>
    </Link>
  );
}
