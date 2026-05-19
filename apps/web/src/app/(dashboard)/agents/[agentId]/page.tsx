import { notFound } from "next/navigation";
import { AgentDetailClient } from "@/components/agents/agent-detail-client";
import type { AgentId } from "@/types/agents";

const AGENT_IDS: AgentId[] = ["live-call", "content", "knowledge", "coaching", "task"];

export function generateStaticParams() {
  return AGENT_IDS.map((id) => ({ agentId: id }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: rawAgentId } = await params;
  const agentId = rawAgentId as AgentId;
  if (!AGENT_IDS.includes(agentId)) notFound();

  return <AgentDetailClient agentId={agentId} />;
}
