"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AgentConfigForm } from "@/components/agents/agent-config-form";
import type { AgentId, AgentConfig } from "@/types/agents";

const AGENT_IDS: AgentId[] = ["live-call", "content", "knowledge", "coaching", "task"];

const AGENT_LABELS: Record<AgentId, string> = {
  "live-call": "Live Call Agent",
  "content": "Content Agent",
  "knowledge": "Knowledge Agent",
  "coaching": "Coaching Agent",
  "task": "Task Agent",
};

const AGENT_DOMAIN_MAP: Record<AgentId, AgentConfig["profile"]["identity"]["allowed_domains"]> = {
  "live-call": ["live_assist"],
  content: ["content_generation"],
  knowledge: ["knowledge_maintenance"],
  coaching: ["coaching_insights"],
  task: ["task_execution"],
};

// ── Mock configs ──────────────────────────────────────────────────────────
function getMockConfig(agentId: AgentId): AgentConfig {
  const base: AgentConfig = {
    agent_id: agentId,
    profile: {
      profile_version: "1.0.0",
      immutable_revision: 4,
      identity: {
        name: AGENT_LABELS[agentId],
        role: `${AGENT_LABELS[agentId]} specialist`,
        allowed_domains: AGENT_DOMAIN_MAP[agentId],
        persona_boundaries: [
          "Do not fabricate product commitments.",
          "Escalate compliance or legal ambiguity to a human reviewer.",
        ],
      },
      runtime: {
        provider: "hybrid",
        model_routing_policy: agentId === "coaching" ? "quality_first" : "balanced",
        latency_budget_ms: agentId === "live-call" ? 1800 : 3200,
        max_turns: agentId === "live-call" ? 6 : 10,
        timeout_ms: 7000,
        retry_budget: 2,
      },
      memory: {
        session_ttl_seconds: 3600,
        long_term_memory_enabled: agentId !== "live-call",
        retention_days: 30,
      },
      tools: [
        {
          tool_name: "kb_search",
          timeout_ms: 1200,
          quota_per_hour: 1800,
          input_schema_version: "2026-05-01",
          side_effecting: false,
        },
        {
          tool_name: agentId === "task" ? "crm_write" : "analytics_query",
          timeout_ms: 2000,
          quota_per_hour: 400,
          input_schema_version: "2026-05-01",
          side_effecting: agentId === "task",
        },
      ],
      output_contract: {
        allowed_formats: ["markdown", "json"],
        required_fields: ["summary", "evidence"],
        forbidden_content_classes: ["pii_leak", "secret_exposure"],
      },
      risk_tier: agentId === "task" || agentId === "coaching" ? "high" : "medium",
      escalation: {
        enabled: true,
        max_auto_attempts: 2,
        confidence_threshold: 0.62,
        triggers: ["policy_violation", "low_confidence", "tool_failure"],
        fallback_action: "handoff_human",
      },
    },
    model_policy: {
      primary: agentId === "coaching" ? "opus" : agentId === "content" ? "sonnet" : "haiku",
      fallback: agentId === "coaching" ? "sonnet" : "haiku",
      model_name: agentId === "coaching" ? "claude-3-opus-20240229" : agentId === "content" ? "claude-3-5-sonnet-20241022" : "claude-3-haiku-20240307",
      fallback_model_name: agentId === "coaching" ? "claude-3-5-sonnet-20241022" : "claude-3-haiku-20240307",
    },
    cost_cap: {
      per_run_ceiling_usd: agentId === "coaching" ? 0.15 : agentId === "content" ? 0.05 : 0.02,
      abort_strategy: "degrade",
    },
    throttle: {
      max_nudges_per_window: 3,
      window_seconds: 300,
      max_concurrent_runs: agentId === "live-call" ? 5 : 3,
    },
    failure_behaviour: {
      max_retries: 3,
      retry_delay_ms: 500,
      fallback_strategy: "degrade_gracefully",
      alert_on_failure: true,
    },
    guardrails: {
      policy_version: "2026.05.1",
      pre_input: {
        execution_order: 1,
        rules: [
          { id: "pre-intent", name: "Intent and risk classify", description: "Classify request intent, risk, and policy domain before processing.", severity: "warn", mode: "enforce", enabled: true },
          { id: "pre-pii", name: "PII and secret mask", description: "Mask emails, tokens, and account IDs before prompt construction.", severity: "block", mode: "enforce", enabled: true },
          { id: "pre-abuse", name: "Rate and token quota", description: "Apply per-tenant request/token budgets and abuse controls.", severity: "block", mode: "enforce", enabled: true },
        ],
      },
      in_generation: {
        execution_order: 2,
        rules: [
          { id: "gen-stream-mod", name: "Streaming moderation", description: "Check partial output chunks for harmful content before emission.", severity: "block", mode: "enforce", enabled: true },
          { id: "gen-tool-policy", name: "Tool-call policy", description: "Validate schema, destination, and risk tier for each tool call.", severity: "block", mode: "enforce", enabled: true },
          { id: "gen-stateful", name: "Stateful constraint check", description: "Deny disallowed operations by session state and role.", severity: "warn", mode: "enforce", enabled: true },
        ],
      },
      post_output: {
        execution_order: 3,
        rules: [
          { id: "post-contract", name: "Output contract validation", description: "Validate final structure and required fields before send.", severity: "block", mode: "enforce", enabled: true },
          { id: "post-redaction", name: "Leak redaction pass", description: "Final scan and redact sensitive values before delivery.", severity: "block", mode: "enforce", enabled: true },
          { id: "post-confidence", name: "Confidence and escalation", description: "Tag low-confidence outputs and trigger fallback/escalation.", severity: "warn", mode: "enforce", enabled: true },
        ],
      },
    },
    workflow: {
      version: "1.0.0",
      states: [
        "receive_input",
        "validate_input",
        "policy_check",
        "plan_step",
        "execute_tool",
        "evaluate_result",
        "stream_response",
        "final_policy_check",
        "deliver",
        "escalate_human",
      ],
      transitions: [
        { from: "receive_input", to: "validate_input", condition: "input_received" },
        { from: "validate_input", to: "policy_check", condition: "payload_valid" },
        { from: "policy_check", to: "plan_step", condition: "policy_pass" },
        { from: "plan_step", to: "execute_tool", condition: "tool_required" },
        { from: "execute_tool", to: "evaluate_result", condition: "tool_finished" },
        { from: "evaluate_result", to: "plan_step", condition: "needs_additional_step" },
        { from: "evaluate_result", to: "stream_response", condition: "ready_to_respond" },
        { from: "stream_response", to: "final_policy_check", condition: "response_complete" },
        { from: "final_policy_check", to: "deliver", condition: "final_guardrail_pass" },
        { from: "final_policy_check", to: "escalate_human", condition: "final_guardrail_fail" },
        { from: "escalate_human", to: "deliver", condition: "handoff_or_safe_refusal_ready" },
      ],
      policy: {
        max_tool_iterations: 3,
        allow_parallel_readonly_subtasks: true,
        require_idempotency_for_side_effects: true,
        circuit_breaker_threshold: 4,
        fallback_model_on_latency_spike: true,
      },
    },
    observability: {
      event_schema: {
        required_fields: ["session_id", "agent_id", "policy_version", "risk_tier", "tool_call_id"],
        trace_key: "trace_id",
      },
      metrics: [
        { id: "first_token_latency", label: "First token latency", target: 1200, unit: "ms", alert_threshold: 1800 },
        { id: "turn_latency", label: "Turn latency", target: 3500, unit: "ms", alert_threshold: 5000 },
        { id: "tool_error_rate", label: "Tool error rate", target: 2, unit: "%", alert_threshold: 5 },
        { id: "guardrail_hit_rate", label: "Guardrail hit rate", target: 8, unit: "%", alert_threshold: 15 },
        { id: "escalation_rate", label: "Escalation rate", target: 5, unit: "%", alert_threshold: 10 },
      ],
      tracing_enabled: true,
      audit: {
        immutable_log: true,
        retention_days: 365,
        replay_harness_enabled: true,
      },
    },
    rollout: {
      current_stage: "shadow",
      stages: [
        { stage: "simulation", enabled: true, gate: "Historical replay accuracy >= 95%" },
        { stage: "shadow", enabled: true, gate: "No Sev-1 policy misses for 7 days" },
        { stage: "soft_enforcement", enabled: false, gate: "False positive rate < 2%" },
        { stage: "high_risk_first", enabled: false, gate: "High-risk flows fully instrumented" },
        { stage: "continuous_tuning", enabled: false, gate: "Weekly drift review automation active" },
      ],
    },
    active_prompt_versions: [
      {
        version: "1.4.2",
        label: `${agentId}_main`,
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        reviewed_by: "Ahmad",
        changelog: "Improved citation grounding; reduced hallucination rate by 12% on internal eval set.",
        is_active: true,
      },
      {
        version: "1.3.0",
        label: `${agentId}_main`,
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        reviewed_by: "Ahmad",
        changelog: "Added role-aware output routing. Fixed edge case where signals were dropped on rapid-fire transcript events.",
        is_active: false,
      },
      {
        version: "1.2.1",
        label: `${agentId}_main`,
        deployed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        reviewed_by: "Ahmad",
        changelog: "Initial stable release. Baseline for A/B test cohort.",
        is_active: false,
      },
    ],
  };

  if (agentId === "live-call") {
    base.signal_routing = [
      { id: "sr-1", keyword_pattern: "competitor|alternative|vs\\s|compared to", signal_type: "competitor_mentioned", nudge_type: "objection_handler", target_role: "AE", enabled: true, confidence_threshold: 0.75 },
      { id: "sr-2", keyword_pattern: "budget|cost|price|pricing|invoice|spend", signal_type: "budget_signal", nudge_type: "discovery_question", target_role: "AE", enabled: true, confidence_threshold: 0.70 },
      { id: "sr-3", keyword_pattern: "integration|API|technical|architecture|stack", signal_type: "technical_question", nudge_type: "reference_asset", target_role: "SE", enabled: true, confidence_threshold: 0.65 },
      { id: "sr-4", keyword_pattern: "timeline|deadline|launch|go-live|urgent", signal_type: "timeline_signal", nudge_type: "discovery_question", target_role: "AE", enabled: true, confidence_threshold: 0.70 },
      { id: "sr-5", keyword_pattern: "design|mockup|prototype|UX|demo", signal_type: "design_query", nudge_type: "reference_asset", target_role: "Designer", enabled: false, confidence_threshold: 0.60 },
    ];
  }

  return base;
}

export default function AgentConfigPage({ params }: { params: Promise<{ agentId: string }> }) {
  const { agentId: rawAgentId } = use(params);
  const agentId = rawAgentId as AgentId;
  if (!AGENT_IDS.includes(agentId)) notFound();

  const config = getMockConfig(agentId);
  const label = AGENT_LABELS[agentId];

  function handleSave(updated: AgentConfig) {
    console.log("Saving config for", agentId, updated);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link href="/agents" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Agents
        </Link>
        <span className="text-muted-foreground">/</span>
        <Link href={`/agents/${agentId}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {label}
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm font-medium">Configuration</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">{label} — Configuration</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Model policy, cost caps, throttle settings, signal routing, and prompt versions.
          Changes take effect immediately after saving.
        </p>
      </div>

      {/* Config form */}
      <AgentConfigForm agentId={agentId} config={config} onSave={handleSave} />
    </div>
  );
}
