"use client";

import { Phone, Search } from "lucide-react";
import { CallCard } from "@/components/call-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalls } from "@/lib/data/hooks";
import { useDcImportsStore } from "@/stores/use-dc-imports";

export function CallsListClient() {
  const { data: calls = [], isLoading } = useCalls();
  const hasImport = useDcImportsStore((s) => s.preDcRecords.length > 0);

  const upcoming = calls.filter((c) => c.status === "upcoming" || c.status === "live");
  const past = calls.filter((c) => c.status === "completed" || c.status === "no-show");

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Calls</h1>
        {hasImport && (
          <p className="text-sm text-muted-foreground mt-1">
            {calls.length} Pre-DC leads — each call is scheduled using Discovery Call Date &amp; Time
            (PKT) from your CSV
          </p>
        )}
      </div>

      {!hasImport ? (
        <EmptyState
          icon={Phone}
          title="No leads yet"
          description="Import pre_dc_notes_data.csv in Settings to populate calls and briefs."
          action={{ label: "Import CSV", href: "/settings" }}
        />
      ) : (
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            All leads
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

        <TabsContent value="all" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {calls.map((call) => (
              <CallCard key={call.id} call={call} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4">
          {upcoming.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {upcoming.map((call) => (
                <CallCard key={call.id} call={call} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Phone}
              title="No upcoming calls"
              description="Import Pre-DC CSV in Settings or wait for scheduled calls."
              action={{ label: "Import data", href: "/settings" }}
            />
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {past.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {past.map((call) => (
                <CallCard key={call.id} call={call} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Search}
              title="No past calls"
              description="Completed discovery calls will appear here."
            />
          )}
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
