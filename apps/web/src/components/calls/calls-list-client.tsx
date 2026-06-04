"use client";

import { useState } from "react";
import { Phone, Search } from "lucide-react";
import { CallCard } from "@/components/call-card";
import { CallsTable } from "@/components/calls/calls-table";
import { CallsViewToggle, type CallsViewMode } from "@/components/calls/calls-view-toggle";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { PageShell } from "@/components/layout/page-shell";
import { CallsListPageLoader } from "@/components/layout/page-loaders";
import { useCalls } from "@/lib/data/hooks";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import type { Call } from "@/types";

function CallsGrid({ calls }: { calls: Call[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 pb-1">
      {calls.map((call) => (
        <CallCard key={call.id} call={call} />
      ))}
    </div>
  );
}

function CallsTabContent({
  calls,
  view,
  emptyState,
}: {
  calls: Call[];
  view: CallsViewMode;
  emptyState?: React.ReactNode;
}) {
  if (emptyState) {
    return <>{emptyState}</>;
  }

  if (view === "list") {
    return <CallsTable calls={calls} />;
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1 -mr-1">
      <CallsGrid calls={calls} />
    </div>
  );
}

const tabsContentClassName =
  "mt-0 flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden";

function CallsTabPanels({
  calls,
  upcoming,
  past,
  view,
}: {
  calls: Call[];
  upcoming: Call[];
  past: Call[];
  view: CallsViewMode;
}) {
  return (
    <>
      <TabsContent value="all" className={tabsContentClassName}>
        <CallsTabContent calls={calls} view={view} />
      </TabsContent>

      <TabsContent value="upcoming" className={tabsContentClassName}>
        <CallsTabContent
          calls={upcoming}
          view={view}
          emptyState={
            upcoming.length === 0 ? (
              <EmptyState
                icon={Phone}
                title="No upcoming calls"
                description="Import Pre-DC CSV in Settings or wait for scheduled calls."
                action={{ label: "Import data", href: "/settings" }}
              />
            ) : undefined
          }
        />
      </TabsContent>

      <TabsContent value="past" className={tabsContentClassName}>
        <CallsTabContent
          calls={past}
          view={view}
          emptyState={
            past.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No past calls"
                description="Completed discovery calls will appear here."
              />
            ) : undefined
          }
        />
      </TabsContent>
    </>
  );
}

export function CallsListClient() {
  const { data: calls = [], isLoading } = useCalls();
  const importsHydrated = useDcImportsStore((s) => s.importsHydrated);
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);
  const [view, setView] = useState<CallsViewMode>("list");

  const upcoming = calls.filter((c) => c.status === "upcoming" || c.status === "live");
  const past = calls.filter((c) => c.status === "completed" || c.status === "no-show");

  if ((!importsHydrated || isLoading) && calls.length === 0) {
    return <CallsListPageLoader />;
  }

  return (
    <PageShell size="wide" className="flex min-h-0 flex-1 flex-col space-y-6 overflow-hidden">
      <header className="shrink-0 pt-2">
        <h1 className="type-headline sm:type-display text-foreground">Calls</h1>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-body-sm text-muted-foreground">
            {hasImport
              ? `${calls.length} Pre-DC leads — scheduled from Discovery Call Date & Time (PKT) in your CSV`
              : "Import Pre-DC CSV in Settings to populate discovery calls and briefs."}
          </p>
          {hasImport && <CallsViewToggle view={view} onChange={setView} />}
        </div>
      </header>

      {!hasImport ? (
        <EmptyState
          icon={Phone}
          title="No leads yet"
          description="Import pre_dc_notes_data.csv in Settings to populate calls and briefs."
          action={{ label: "Import CSV", href: "/settings" }}
        />
      ) : (
        <Tabs defaultValue="all" className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
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

          {view === "list" ? (
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 pt-2 pb-0">
                <CallsTabPanels
                  calls={calls}
                  upcoming={upcoming}
                  past={past}
                  view={view}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <CallsTabPanels
                calls={calls}
                upcoming={upcoming}
                past={past}
                view={view}
              />
            </div>
          )}
        </Tabs>
      )}
    </PageShell>
  );
}
