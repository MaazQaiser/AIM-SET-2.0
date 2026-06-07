import { ClipboardList, DollarSign, ShieldCheck, Activity, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { GovernanceAuditTable } from "@/components/governance/governance-audit-table";
import { EmptyState } from "@dc-copilot/ui/components/empty-state";

export const metadata: Metadata = { title: "Governance" };

const rolloutStages = [
  { stage: "Stage 0 · Simulation", status: "complete", gate: "Historical replay accuracy >= 95%" },
  { stage: "Stage 1 · Shadow mode", status: "active", gate: "No Sev-1 policy misses for 7 days" },
  { stage: "Stage 2 · Soft enforcement", status: "queued", gate: "False positive rate < 2%" },
  { stage: "Stage 3 · High-risk-first enforcement", status: "queued", gate: "All high-risk flows instrumented" },
  { stage: "Stage 4 · Continuous tuning", status: "queued", gate: "Weekly drift review automation live" },
];

export default function GovernancePage() {
  return (
    <PageShell>
      <PageHeader>
        <h1 className="type-page-title text-foreground">Governance</h1>
        <p className="mt-1 type-body-sm text-muted-foreground">Audit, compliance, and AI cost policy</p>
      </PageHeader>

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

        <TabsContent value="cost" className="mt-4">
          <EmptyState
            icon={DollarSign}
            title="Cost analytics unavailable"
            description="Connect billing and agent cost reporting to see spend breakdowns and cap incidents."
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <GovernanceAuditTable />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance posture</CardTitle>
              <CardDescription>Recording consent and data residency</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border bg-muted/40 p-4">
                <p className="type-panel-title">Recording consent</p>
                <p className="mt-1 type-body-sm text-muted-foreground">
                  Configure consent capture before the meeting bot joins a call.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="type-body-sm text-muted-foreground">Primary region:</span>
                <Badge>Not configured</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="observability" className="mt-4 space-y-4">
          <EmptyState
            icon={Activity}
            title="No telemetry data"
            description="Realtime latency and guardrail metrics appear when observability is connected."
          />

          <Card>
            <CardHeader>
              <CardTitle>Event schema and audit policy</CardTitle>
              <CardDescription>Immutable policy decisions with replay-ready traces</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 type-body-sm">
              <div className="rounded-md border bg-muted/40 p-3">
                Required fields:{" "}
                <span className="font-mono">
                  session_id, agent_id, policy_version, risk_tier, tool_call_id
                </span>
              </div>
              <p className="text-muted-foreground">
                Trace key: <span className="font-mono">trace_id</span> · Retention: per tenant policy
              </p>
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
                <div
                  key={item.stage}
                  className="grid grid-cols-3 items-center border-b pb-2 type-body-sm last:border-0"
                >
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
    </PageShell>
  );
}
