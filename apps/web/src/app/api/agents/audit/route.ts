import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { ActivityEvent, AgentId } from "@/types/agents";

const AGENT_IDS: AgentId[] = ["live-call", "content", "content_generation", "knowledge", "coaching", "task"];

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const res = await fetch(`${process.env.API_URL ?? "http://localhost:8000"}/api/v1/agents/audit`, {
    headers: {
      "x-user-id": userId,
      ...(orgId ? { "x-tenant-id": orgId, "x-clerk-org-id": orgId } : { "x-tenant-id": userId }),
    },
    cache: "no-store",
  });

  if (!res.ok) return NextResponse.json([]);

  const rows = (await res.json()) as {
    id?: string;
    agent?: string;
    action?: string;
    trace_id?: string;
    created_at?: string;
    payload?: Record<string, unknown>;
  }[];

  const mapEventType = (action?: string): ActivityEvent["event_type"] => {
    const a = (action ?? "").toLowerCase();
    if (a.includes("nudge")) return "nudge_sent";
    if (a.includes("brief")) return "brief_generated";
    if (a.includes("ingest") || a.includes("embed")) return "asset_ingested";
    if (a.includes("scorecard") || a.includes("coaching")) return "scorecard_produced";
    if (a.includes("email")) return "email_drafted";
    if (a.includes("crm") || a.includes("task")) return "crm_task_created";
    if (a.includes("fail")) return "run_failed";
    if (a.includes("bot") || a.includes("chat")) return "bot_chat_answered";
    return "brief_generated";
  };

  const events: ActivityEvent[] = rows.map((row, i) => ({
    id: row.id ?? `audit-${i}`,
    agent_id: (AGENT_IDS.includes(row.agent as AgentId) ? row.agent : "task") as AgentId,
    event_type: mapEventType(row.action),
    timestamp: row.created_at ?? new Date().toISOString(),
    description: row.action ?? "Agent activity",
    meta: row.payload,
  }));

  return NextResponse.json(events);
}
