"use client";

import { TrendingUp, Phone, Users, BarChart3 } from "lucide-react";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { StatCard } from "@dc-copilot/ui/components/stat-card";
import { CoachingCard } from "@/components/coaching-card";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { DataTable } from "@dc-copilot/ui/components/data-table";
import { WeeklyPatterns } from "@/components/coaching/weekly-patterns";
import { useCoachingInsights, useCalls } from "@/lib/data/hooks";
import type { ColumnDef } from "@tanstack/react-table";

interface TeamRow {
  name: string;
  calls: number;
  winRate: string;
  briefUsage: string;
  avgBANT: string;
}

const teamColumns: ColumnDef<TeamRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "calls", header: "Calls" },
  { accessorKey: "winRate", header: "Win rate" },
  { accessorKey: "briefUsage", header: "Brief usage" },
  { accessorKey: "avgBANT", header: "Avg BANT score" },
];

export default function CoachingPage() {
  const { data: insights = [] } = useCoachingInsights();
  const { data: calls = [] } = useCalls();

  const teamRows: TeamRow[] = [];

  return (
    <PageShell className="space-y-8">
      <PageHeader>
        <h1 className="text-2xl font-semibold text-foreground">Coaching</h1>
        <p className="text-sm text-muted-foreground mt-1">Team performance</p>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Calls" value={calls.length} icon={Phone} />
        <StatCard title="Team win rate" value="—" icon={TrendingUp} />
        <StatCard title="Active AEs" value="—" icon={Users} />
        <StatCard title="Coaching candidates" value={insights.length} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Individual scorecards</CardTitle>
        </CardHeader>
        <CardContent>
          {teamRows.length > 0 ? (
            <DataTable
              columns={teamColumns}
              data={teamRows}
              searchKey="name"
              searchPlaceholder="Search by name..."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No team scorecards"
              description="Per-AE metrics will appear when coaching analytics are connected."
            />
          )}
        </CardContent>
      </Card>

      <WeeklyPatterns />

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Coaching recommendations</h2>
        {insights.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {insights.map((insight) => (
              <CoachingCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No coaching recommendations"
            description="Recommendations appear after calls are analyzed."
          />
        )}
      </section>
    </PageShell>
  );
}
