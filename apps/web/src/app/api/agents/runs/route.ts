import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { AgentId, AgentRun } from "@/types/agents";

const AGENT_IDS: AgentId[] = ["live-call", "content", "content_generation", "knowledge", "coaching", "task"];

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/v1/agents/runs`, {
    headers: {
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json([]);

  const rows = (await res.json()) as {
    id?: string;
    agent_id?: string;
    operation?: string;
    trace_id?: string;
    status?: string;
    cost_usd?: number;
    tokens_used?: number;
    model_used?: string;
    created_at?: string;
  }[];

  const runs: AgentRun[] = rows.map((row, i) => ({
    id: row.id ?? `run-${i}`,
    agent_id: (AGENT_IDS.includes(row.agent_id as AgentId) ? row.agent_id : "content") as AgentId,
    trigger: "manual",
    triggered_at: row.created_at ?? new Date().toISOString(),
    completed_at: row.created_at,
    outcome: row.status === "success" ? "success" : "failed",
    cost_usd: Number(row.cost_usd) || 0,
    tokens_used: Number(row.tokens_used) || 0,
    model_used: row.model_used ?? "",
    operation: row.operation ?? "",
    trace_id: row.trace_id ?? "",
  }));

  return NextResponse.json(runs);
}
