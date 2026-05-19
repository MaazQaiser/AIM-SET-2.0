import { ClipboardList, DollarSign, ShieldCheck, Activity, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Governance" };

interface AuditRow {
  timestamp: string;
  agent: string;
  action: string;
  user: string;
  cost: string;
}

const auditRows: AuditRow[] = [
  { timestamp: "2026-05-18 14:32", agent: "Live Call", action: "proactive_nudge", user: "Sarah Mendes", cost: "$0.014" },
  { timestamp: "2026-05-18 13:01", agent: "Task Agent", action: "draft_email", user: "Maya Rivera", cost: "$0.023" },
  { timestamp: "2026-05-17 10:15", agent: "Coaching", action: "weekly_analysis", user: "System", cost: "$0.182" },
  { timestamp: "2026-05-16 09:22", agent: "Governance", action: "gdpr_export", user: "Head of Customer Success", cost: "—" },
];

const auditColumns: ColumnDef<AuditRow>[] = [
  { accessorKey: "timestamp", header: "Timestamp" },
  { accessorKey: "agent", header: "Agent" },
  { accessorKey: "action", header: "Action" },
  { accessorKey: "user", header: "User" },
  { accessorKey: "cost", header: "AI cost" },
];

const costCapIncidents = [
  { date: "2026-05-12", agent: "Coaching", action: "Auto-degraded to Sonnet", ae: "System" },
  { date: "2026-05-08", agent: "Live Call", action: "Hard stop — monthly cap", ae: "Jordan Bell" },
];

const realtimeMetrics = [
  { metric: "First token latency (p95)", target: "<= 1200ms", current: "1080ms", status: "healthy" },
  { metric: "Turn latency (p95)", target: "<= 3500ms", current: "3310ms", status: "healthy" },
  { metric: "Tool error rate", target: "<= 2%", current: "2.4%", status: "watch" },
  { metric: "Guardrail hit rate", target: "<= 8%", current: "6.1%", status: "healthy" },
  { metric: "Escalation rate", target: "<= 5%", current: "4.2%", status: "healthy" },
];

const rolloutStages = [
  { stage: "Stage 0 · Simulation", status: "complete", gate: "Historical replay accuracy >= 95%" },
  { stage: "Stage 1 · Shadow mode", status: "active", gate: "No Sev-1 policy misses for 7 days" },
  { stage: "Stage 2 · Soft enforcement", status: "queued", gate: "False positive rate < 2%" },
  { stage: "Stage 3 · High-risk-first enforcement", status: "queued", gate: "All high-risk flows instrumented" },
  { stage: "Stage 4 · Continuous tuning", status: "queued", gate: "Weekly drift review automation live" },
];

export default function GovernancePage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Governance</h1>
        <p className="text-sm text-muted-foreground mt-1">Audit, compliance, and AI cost policy</p>
      </div>

      <Tabs defaultValue="cost">
        <TabsList>
          <TabsTrigger value="cost">
            <DollarSign className="h-3.5 w-3.5" />
            AI cost
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ClipboardList className="h-3.5 w-3.5" />
            Audit log
          </TabsTrigger>
          <TabsTrigger value="compliance">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="observability">
            <Activity className="h-3.5 w-3.5" />
            Observability
          </TabsTrigger>
          <TabsTrigger value="rollout">
            <Rocket className="h-3.5 w-3.5" />
            Rollout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cost" className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Q3 total spend</p>
                <p className="text-3xl font-bold mt-1">$47,200</p>
                <p className="text-xs text-muted-foreground mt-1">Per-call avg: $3.18 · Per-AE/mo: $620</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Most expensive op</p>
                <p className="text-lg font-bold mt-1">Weekly win-loss</p>
                <p className="text-xs text-muted-foreground">Acceptable at scale</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">Cheapest agent</p>
                <p className="text-lg font-bold mt-1">Live keyword extract</p>
                <p className="text-xs text-success">Haiku tier · correct</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Cost-cap incidents (Q3)</CardTitle>
              <CardDescription>Auto-handled events; AEs notified, work queued</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {costCapIncidents.map((inc) => (
                <div key={inc.date} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{inc.date}</span>
                  <span>{inc.agent}</span>
                  <span className="text-foreground">{inc.action}</span>
                  <Badge variant="outline">{inc.ae}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>All agent actions · 12-month retention · includes GDPR exports</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={auditColumns} data={auditRows} searchKey="agent" searchPlaceholder="Filter by agent..." />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance posture</CardTitle>
              <CardDescription>Recording consent and data residency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="text-sm font-medium">Recording consent</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Captured before meeting bot joins. US default disclosure active for all tenants.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Primary region:</span>
                <Badge>US East (N. Virginia)</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Transcript retention: 24 months</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observability" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Realtime telemetry</CardTitle>
              <CardDescription>Latency, reliability, and guardrail outcomes for orchestration lifecycle</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {realtimeMetrics.map((row) => (
                <div key={row.metric} className="grid grid-cols-4 items-center text-sm border-b pb-2 last:border-0">
                  <span className="col-span-2">{row.metric}</span>
                  <span className="text-muted-foreground">target {row.target}</span>
                  <div className="flex items-center justify-end gap-2">
                    <span>{row.current}</span>
                    <Badge
                      variant="outline"
                      className={row.status === "healthy" ? "text-success border-success/40 bg-success/5" : "text-warning border-warning/40 bg-warning/5"}
                    >
                      {row.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Event schema and audit policy</CardTitle>
              <CardDescription>Immutable policy decisions with replay-ready traces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/40 p-3">
                Required fields: <span className="font-mono">session_id, agent_id, policy_version, risk_tier, tool_call_id</span>
              </div>
              <p className="text-muted-foreground">Trace key: <span className="font-mono">trace_id</span> · Retention: 365 days · Replay harness: enabled</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rollout" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Progressive guardrail rollout</CardTitle>
              <CardDescription>Go/no-go gates from simulation through full enforcement</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {rolloutStages.map((item) => (
                <div key={item.stage} className="grid grid-cols-3 items-center text-sm border-b pb-2 last:border-0">
                  <span>{item.stage}</span>
                  <span className="text-muted-foreground">{item.gate}</span>
                  <div className="flex justify-end">
                    <Badge
                      variant="outline"
                      className={
                        item.status === "complete"
                          ? "text-success border-success/40 bg-success/5"
                          : item.status === "active"
                            ? "text-primary border-primary/40 bg-primary/5"
                            : "text-muted-foreground"
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
