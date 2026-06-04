"use client";

import { useState } from "react";
import { Phone, Search } from "lucide-react";
import { CallCard } from "@/components/call-card";
import { CallsTable } from "@/components/calls/calls-table";
import { CallsViewToggle, type CallsViewMode } from "@/components/calls/calls-view-toggle";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { AssistantGreeting } from "@/components/dashboard/assistant-greeting";
import { PageShell } from "@/components/layout/page-shell";
import { useCalls } from "@/lib/data/hooks";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import type { Call } from "@/types";

function CallsGrid({ calls }: { calls: Call[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} />
      ))}
    </div>
  );
}

function CallsBody({ calls, view }: { calls: Call[]; view: CallsViewMode }) {
  if (view === "list") {
    return <CallsTable calls={calls} />;
  }
  return <CallsGrid calls={calls} />;
}

function ListLoadingSkeleton({ view }: { view: CallsViewMode }) {
  if (view === "list") {
    return (
      <div className="space-y-2 overflow-hidden bg-transparent">
        <Skeleton className="h-10 w-full rounded-none bg-muted/30" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none bg-transparent" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-48 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function CallsListClient() {
  const { data: calls = [], isLoading } = useCalls();
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);
  const [view, setView] = useState<CallsViewMode>("list");

  const upcoming = calls.filter((c) => c.status === "upcoming" || c.status === "live");
  const past = calls.filter((c) => c.status === "completed" || c.status === "no-show");

  if (isLoading) {
    return (
      <PageShell size="wide" className="flex min-h-0 flex-1 flex-col space-y-6">
        <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <Skeleton className="h-10 w-full max-w-xl rounded-none bg-muted/40" />
          <Card className="flex min-h-0 flex-1 flex-col">
            <CardContent className="space-y-4 p-5 pt-5">
              <ListLoadingSkeleton view={view} />
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell size="wide" className="flex min-h-0 flex-1 flex-col space-y-6">
      <AssistantGreeting />

      {hasImport && (
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-sm text-muted-foreground">
            {calls.length} Pre-DC leads — scheduled from Discovery Call Date &amp; Time (PKT) in your
            CSV
          </p>
          <CallsViewToggle view={view} onChange={setView} />
        </div>
      )}

      {!hasImport ? (
        <EmptyState
          icon={Phone}
          title="No leads yet"
          description="Import pre_dc_notes_data.csv in Settings to populate calls and briefs."
          action={{ label: "Import CSV", href: "/settings" }}
        />
      ) : (
        <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col gap-4">
          <TabsList className="h-auto w-full shrink-0 justify-start gap-4 rounded-none border-b border-border/60 bg-transparent p-0">
            <TabsTrigger value="all">
              All
              <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                {calls.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="upcoming">
              Upcoming
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {upcoming.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="past">
              Past
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium">
                {past.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <Card className="flex min-h-0 flex-1 flex-col">
            <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 p-5 pt-5">
              <TabsContent value="all" className="min-h-0 flex-1 focus-visible:outline-none mt-0">
                <CallsBody calls={calls} view={view} />
              </TabsContent>

              <TabsContent value="upcoming" className="min-h-0 flex-1 focus-visible:outline-none mt-0">
                {upcoming.length > 0 ? (
                  <CallsBody calls={upcoming} view={view} />
                ) : (
                  <EmptyState
                    icon={Phone}
                    title="No upcoming calls"
                    description="Import Pre-DC CSV in Settings or wait for scheduled calls."
                    action={{ label: "Import data", href: "/settings" }}
                  />
                )}
              </TabsContent>

              <TabsContent value="past" className="min-h-0 flex-1 focus-visible:outline-none mt-0">
                {past.length > 0 ? (
                  <CallsBody calls={past} view={view} />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No past calls"
                    description="Completed discovery calls will appear here."
                  />
                )}
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
      )}
    </PageShell>
  );
}
