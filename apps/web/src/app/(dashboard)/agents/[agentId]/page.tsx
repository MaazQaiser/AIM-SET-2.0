import { notFound } from "next/navigation";
import { AgentDetailClient } from "@/components/agents/agent-detail-client";
import { isProjectAgentId, PROJECT_AGENT_IDS } from "@/lib/agents/catalog";
import type { AgentId } from "@/types/agents";

export function generateStaticParams() {
  return PROJECT_AGENT_IDS.map((id) => ({ agentId: id }));
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: rawAgentId } = await params;
  if (!isProjectAgentId(rawAgentId)) notFound();

  return <AgentDetailClient agentId={rawAgentId as AgentId} />;
}
