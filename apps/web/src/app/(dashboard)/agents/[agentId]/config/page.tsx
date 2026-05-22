import { notFound } from "next/navigation";
import { AgentConfigPageClient } from "@/components/agents/agent-config-page-client";
import { AGENT_LABELS, isProjectAgentId, PROJECT_AGENT_IDS } from "@/lib/agents/catalog";
import type { AgentId } from "@/types/agents";

export function generateStaticParams() {
  return PROJECT_AGENT_IDS.map((id) => ({ agentId: id }));
}

export default async function AgentConfigPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: rawAgentId } = await params;
  if (!isProjectAgentId(rawAgentId)) notFound();
  const agentId = rawAgentId as AgentId;

  return <AgentConfigPageClient agentId={agentId} label={AGENT_LABELS[agentId]} />;
}
