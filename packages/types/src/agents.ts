// ── Agent IDs ──────────────────────────────────────────────────────────────
export type AgentId =
  | "live-call"
  | "discovery-checklist"
  | "content"
  | "workflow"
  | "post_dc"
  | "content_generation";

// ── Agent health ───────────────────────────────────────────────────────────
export type AgentHealth = "healthy" | "degraded" | "outage" | "idle";

// ── Model tiers (from 04_Tech_Stack.md MODEL_POLICY) ──────────────────────
export type ModelTier = "haiku" | "sonnet" | "opus";

export interface ModelPolicy {
  primary: ModelTier;
  fallback: ModelTier;
  model_name: string;
  fallback_model_name: string;
}

// ── Cost caps ──────────────────────────────────────────────────────────────
export type CostAbortStrategy = "hard_stop" | "degrade" | "alert_only";

export interface CostCapConfig {
  per_run_ceiling_usd: number;
  abort_strategy: CostAbortStrategy;
  /** Studio / project-level spend cap (Content Generation Agent). */
  project_ceiling_usd?: number;
}

// ── Throttle settings ──────────────────────────────────────────────────────
export interface ThrottleConfig {
  max_nudges_per_window: number;
  window_seconds: number;
  max_concurrent_runs: number;
}

// ── Prompt version ─────────────────────────────────────────────────────────
export interface PromptVersion {
  version: string;           // semver e.g. "1.4.2"
  label: string;             // e.g. "proactive_nudge"
  deployed_at: string;       // ISO date
  reviewed_by: string;
  changelog: string;
  is_active: boolean;
}

// ── Signal routing (Live Call Agent only) ──────────────────────────────────
export type NudgeType = "objection_handler" | "reference_asset" | "discovery_question" | "risk_flag";
export type TargetRole = "AE" | "SE" | "Designer" | "all";

export interface SignalRoutingRule {
  id: string;
  keyword_pattern: string;   // regex or keyword list
  signal_type: string;
  nudge_type: NudgeType;
  target_role: TargetRole;
  enabled: boolean;
  confidence_threshold: number;
}

// ── Failure behaviour ──────────────────────────────────────────────────────
export type FallbackStrategy = "serve_from_cache" | "degrade_gracefully" | "alert_and_skip";

export interface FailureBehaviourConfig {
  max_retries: number;
  retry_delay_ms: number;
  fallback_strategy: FallbackStrategy;
  alert_on_failure: boolean;
}

// ── Realtime agent profile (versioned) ─────────────────────────────────────
export type AllowedDomain =
  | "live_assist"
  | "content_generation"
  | "knowledge_maintenance"
  | "coaching_insights"
  | "task_execution";

export interface AgentIdentityProfile {
  name: string;
  role: string;
  allowed_domains: AllowedDomain[];
  persona_boundaries: string[];
}

export interface RuntimeProfile {
  provider: "anthropic" | "openai" | "hybrid";
  model_routing_policy: "latency_first" | "balanced" | "quality_first";
  latency_budget_ms: number;
  max_turns: number;
  timeout_ms: number;
  retry_budget: number;
}

export interface MemoryProfile {
  session_ttl_seconds: number;
  long_term_memory_enabled: boolean;
  retention_days: number;
}

export interface ToolContract {
  tool_name: string;
  timeout_ms: number;
  quota_per_hour: number;
  input_schema_version: string;
  side_effecting: boolean;
}

export interface OutputContract {
  allowed_formats: Array<"markdown" | "json" | "plain_text" | "structured_blocks">;
  required_fields: string[];
  forbidden_content_classes: Array<"pii_leak" | "secret_exposure" | "legal_advice" | "medical_advice" | "financial_advice">;
}

export type RiskTier = "low" | "medium" | "high";

export interface EscalationPolicy {
  enabled: boolean;
  max_auto_attempts: number;
  confidence_threshold: number;
  triggers: string[];
  fallback_action: "handoff_human" | "safe_refusal" | "queue_for_review";
}

export interface AgentProfile {
  profile_version: string;
  immutable_revision: number;
  identity: AgentIdentityProfile;
  runtime: RuntimeProfile;
  memory: MemoryProfile;
  tools: ToolContract[];
  output_contract: OutputContract;
  risk_tier: RiskTier;
  escalation: EscalationPolicy;
}

// ── Guardrails (input / generation / output) ───────────────────────────────
export type GuardrailSeverity = "info" | "warn" | "block";
export type GuardrailMode = "shadow" | "enforce";

export interface GuardrailRule {
  id: string;
  name: string;
  description: string;
  severity: GuardrailSeverity;
  mode: GuardrailMode;
  enabled: boolean;
}

export interface GuardrailStage {
  execution_order: number;
  rules: GuardrailRule[];
}

export interface GuardrailPolicy {
  policy_version: string;
  pre_input: GuardrailStage;
  in_generation: GuardrailStage;
  post_output: GuardrailStage;
}

// ── Workflow state machine ─────────────────────────────────────────────────
export type WorkflowState =
  | "receive_input"
  | "validate_input"
  | "policy_check"
  | "plan_step"
  | "execute_tool"
  | "evaluate_result"
  | "stream_response"
  | "final_policy_check"
  | "deliver"
  | "escalate_human";

export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  condition: string;
}

export interface WorkflowPolicy {
  max_tool_iterations: number;
  allow_parallel_readonly_subtasks: boolean;
  require_idempotency_for_side_effects: boolean;
  circuit_breaker_threshold: number;
  fallback_model_on_latency_spike: boolean;
}

export interface WorkflowSpec {
  version: string;
  states: WorkflowState[];
  transitions: WorkflowTransition[];
  policy: WorkflowPolicy;
}

// ── Observability and rollout controls ─────────────────────────────────────
export interface EventSchema {
  required_fields: string[];
  trace_key: string;
}

export interface MetricDefinition {
  id: string;
  label: string;
  target: number;
  unit: "ms" | "%" | "count";
  alert_threshold: number;
}

export interface AuditPolicy {
  immutable_log: boolean;
  retention_days: number;
  replay_harness_enabled: boolean;
}

export interface ObservabilitySpec {
  event_schema: EventSchema;
  metrics: MetricDefinition[];
  tracing_enabled: boolean;
  audit: AuditPolicy;
}

export type RolloutStage = "simulation" | "shadow" | "soft_enforcement" | "high_risk_first" | "continuous_tuning";

export interface RolloutStageConfig {
  stage: RolloutStage;
  enabled: boolean;
  gate: string;
}

export interface RolloutPlan {
  current_stage: RolloutStage;
  stages: RolloutStageConfig[];
}

// ── Full agent config ──────────────────────────────────────────────────────
export interface AgentConfig {
  agent_id: AgentId;
  /** Orchestrator operations this agent handles (read-only, from codebase). */
  operations?: string[];
  /** When set, overrides the active prompt file for this agent. */
  system_prompt_override?: string;
  /** PRE-DC Workflow: per-operation prompt overrides. */
  workflow_prompts?: {
    summary?: string;
    artifact_plan?: string;
    artifact_fulfill?: string;
  };
  /** @deprecated Use workflow_prompts — kept for migrated tenant configs. */
  pre_dc_prompts?: {
    summary?: string;
    artifact_plan?: string;
    artifact_fulfill?: string;
  };
  /** PRE-DC Workflow: UI highlight rules for AI summary (regex pattern + Tailwind class). */
  summary_highlight_rules?: {
    pattern: string;
    className: string;
    flags?: string;
  }[];
  profile: AgentProfile;
  model_policy: ModelPolicy;
  cost_cap: CostCapConfig;
  throttle: ThrottleConfig;
  signal_routing?: SignalRoutingRule[];   // Live Call Agent only
  failure_behaviour: FailureBehaviourConfig;
  guardrails: GuardrailPolicy;
  workflow: WorkflowSpec;
  observability: ObservabilitySpec;
  rollout: RolloutPlan;
  active_prompt_versions: PromptVersion[];
}

// ── Agent run record ───────────────────────────────────────────────────────
export type RunOutcome = "success" | "partial" | "failed" | "aborted";
export type RunTrigger = "live_transcript" | "bot_chat" | "call_end" | "scheduled" | "manual" | "content_gap";

export interface AgentRun {
  id: string;
  agent_id: AgentId;
  trigger: RunTrigger;
  triggered_at: string;
  completed_at?: string;
  duration_ms?: number;
  outcome: RunOutcome;
  cost_usd: number;
  tokens_used: number;
  model_used: string;
  operation: string;
  trace_id: string;
  error_message?: string;
}

// ── Activity event (real-time feed) ────────────────────────────────────────
export type ActivityEventType =
  | "nudge_sent"
  | "nudge_accepted"
  | "nudge_dismissed"
  | "bot_chat_answered"
  | "brief_generated"
  | "asset_ingested"
  | "scorecard_produced"
  | "email_drafted"
  | "crm_task_created"
  | "cost_cap_warning"
  | "model_fallback"
  | "run_failed";

export interface ActivityEvent {
  id: string;
  agent_id: AgentId;
  event_type: ActivityEventType;
  timestamp: string;
  description: string;
  meta?: Record<string, unknown>;
  cost_usd?: number;
}

// ── Agent metrics (vs spec targets) ───────────────────────────────────────
export interface AgentMetric {
  label: string;
  value: number;
  target: number;
  unit: "%" | "s" | "usd" | "count" | "score";
  is_rate: boolean;
}

// ── Agent status summary ───────────────────────────────────────────────────
export interface AgentStatus {
  agent_id: AgentId;
  display_name: string;
  description: string;
  health: AgentHealth;
  model_policy: ModelPolicy;
  cost_today_usd: number;
  /** Gauge reference cap (project ceiling when set, else per-run ceiling). */
  cost_cap_usd: number;
  per_run_cap_usd?: number;
  project_cap_usd?: number;
  runs_today: number;
  last_run_at?: string;
  metrics: AgentMetric[];
}

export interface PromptVersionFile extends PromptVersion {
  path?: string;
}
