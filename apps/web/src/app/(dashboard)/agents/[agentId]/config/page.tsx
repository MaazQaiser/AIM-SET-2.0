import { notFound } from "next/navigation";
import { AgentConfigPageClient } from "@/components/agents/agent-config-page-client";
import type { AgentId } from "@/types/agents";

const AGENT_IDS: AgentId[] = [
  "live-call",
  "discovery-checklist",
  "content",
  "workflow",
  "content_generation",
  "knowledge",
  "coaching",
  "task",
];

const AGENT_LABELS: Record<AgentId, string> = {
  "live-call": "Live Call Agent",
  "discovery-checklist": "Discovery Checklist Tracker",
  content: "Content Agent",
  workflow: "Workflow Agent",
  content_generation: "Content Generation Agent",
  knowledge: "Knowledge Agent",
  coaching: "Coaching Agent",
  task: "Task Agent",
};

export function generateStaticParams() {
  return AGENT_IDS.map((id) => ({ agentId: id }));
}

export default async function AgentConfigPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId: rawAgentId } = await params;
  const agentId = rawAgentId as AgentId;
  if (!AGENT_IDS.includes(agentId)) notFound();

  return <AgentConfigPageClient agentId={agentId} label={AGENT_LABELS[agentId]} />;
}
