"use client";

import { TrendingUp, Phone, Users, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { CoachingCard } from "@/components/coaching-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { WeeklyPatterns } from "@/components/coaching/weekly-patterns";
import { useCoachingInsights } from "@/lib/data/hooks";
import type { ColumnDef } from "@tanstack/react-table";

interface TeamRow {
  name: string;
  calls: number;
  winRate: string;
  briefUsage: string;
  avgBANT: string;
}

const teamRows: TeamRow[] = [
  { name: "Sarah Mendes", calls: 12, winRate: "41%", briefUsage: "75%", avgBANT: "2.3/4" },
  { name: "Maya Rivera", calls: 9, winRate: "44%", briefUsage: "100%", avgBANT: "2.8/4" },
  { name: "Sam Kim", calls: 7, winRate: "29%", briefUsage: "57%", avgBANT: "1.9/4" },
];

const teamColumns: ColumnDef<TeamRow>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "calls", header: "Calls" },
  { accessorKey: "winRate", header: "Win rate" },
  { accessorKey: "briefUsage", header: "Brief usage" },
  { accessorKey: "avgBANT", header: "Avg BANT score" },
];

export default function CoachingPage() {
  const { data: insights = [] } = useCoachingInsights();

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Coaching</h1>
        <p className="text-sm text-muted-foreground mt-1">Team performance · This week</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Calls this week" value={28} icon={Phone} />
        <StatCard title="Team win rate" value="38%" icon={TrendingUp} trend={{ value: 2, label: "vs last week" }} />
        <StatCard title="Active AEs" value={3} icon={Users} />
        <StatCard title="Coaching candidates" value={insights.length} icon={BarChart3} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Individual scorecards</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={teamColumns} data={teamRows} searchKey="name" searchPlaceholder="Search by name..." />
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
          <EmptyState icon={TrendingUp} title="No coaching recommendations" description="Recommendations appear after more calls." />
        )}
      </section>
    </div>
  );
}
