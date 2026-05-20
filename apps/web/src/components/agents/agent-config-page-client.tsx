"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgentConfigForm } from "@/components/agents/agent-config-form";
import { useAgentConfig, useSaveAgentConfig } from "@/lib/data/agent-config-hooks";
import type { AgentConfig, AgentId } from "@/types/agents";

interface AgentConfigPageClientProps {
  agentId: AgentId;
  label: string;
}

export function AgentConfigPageClient({ agentId, label }: AgentConfigPageClientProps) {
  const { data, isLoading, isFetching, error, refetch } = useAgentConfig(agentId);
  const save = useSaveAgentConfig(agentId);
  const [saveMessage, setSaveMessage] = useState<string>("");

  async function handleSave(updated: AgentConfig) {
    setSaveMessage("");
    try {
      await save.mutateAsync(updated);
      setSaveMessage("Settings saved. Changes apply to the next agent run.");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-2">
        <Link
          href="/agents"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link
          href={`/agents/${agentId}`}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {label}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Configuration</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{label} — Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Model policy, cost caps, throttle, and prompts from this repo. Settings are saved per tenant and apply on the next agent run.
        </p>
      </div>

      {isLoading || (isFetching && !data) ? (
        <p className="text-sm text-muted-foreground">Loading agent settings…</p>
      ) : error || !data ? (
        <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-destructive font-medium">Failed to load agent settings</p>
          <p className="text-xs text-muted-foreground">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <p className="text-xs text-muted-foreground">
            Make sure the Python API is running (port 8000) and migration 005_agent_configs.sql is applied if you use Supabase.
          </p>
          <button type="button" className="text-sm underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {saveMessage ? (
            <p
              className={
                saveMessage.includes("saved")
                  ? "text-sm text-green-700"
                  : "text-sm text-destructive"
              }
            >
              {saveMessage}
            </p>
          ) : null}
          <AgentConfigForm
            agentId={agentId}
            config={data}
            onSave={handleSave}
            isSaving={save.isPending}
          />
        </>
      )}
    </div>
  );
}
