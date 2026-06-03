# Production Checklist
**Applies to:** Everything that ships to production
**Audience:** Engineers, reviewers, on-call
**Version:** 0.1 (Draft)

---

## How to use this file

This is the **shippable-to-production gate**. If any item below is unchecked for a release, the release is blocked. No exceptions for "we'll do it next sprint."

Items are grouped by domain. Within each domain, items are listed in order of severity: anything that could cause user harm, data loss, or security incident comes first.

---

## 1. Security

### Authentication & Authorization
- [ ] Every endpoint has an explicit auth dependency (no implicit allow-all)
- [ ] Tenant isolation enforced at the query layer (every query filters by `tenant_id`)
- [ ] RBAC enforced for sensitive operations (delete, share, configure)
- [ ] SSO via Clerk / WorkOS works end-to-end for at least Google and Microsoft
- [ ] Session expiry configured (default 24 hours; configurable per tenant)
- [ ] MFA available for admin roles; required for tenants on enterprise plans
- [ ] No hardcoded credentials in source code (verified by secret scanning in CI)
- [ ] API keys rotatable without downtime

### Data protection
- [ ] All data encrypted at rest (Postgres TDE, object storage encrypted)
- [ ] All data encrypted in transit (TLS 1.3, HSTS, no plaintext anywhere)
- [ ] PII redaction runs on transcripts before they enter the KB
- [ ] Customer consent for recording captured and revocable
- [ ] Data residency controls in place (regional deployment, no cross-region replication without opt-in)
- [ ] Backup encryption verified; restore tested at least quarterly

### Input validation
- [ ] All API inputs validated via Pydantic
- [ ] File uploads size-limited and type-checked (no shell-script execution, no unbounded uploads)
- [ ] SQL injection impossible (parameterized queries only; ORM enforced)
- [ ] XSS impossible (markdown rendering sanitized; no raw HTML insertion)
- [ ] CSRF protection on all state-changing requests from browsers
- [ ] Prompt injection mitigations on user-provided text reaching LLMs (bot-chat queries)

### Network security
- [ ] All services behind a WAF (Cloudflare or equivalent)
- [ ] Rate limiting on every public endpoint
- [ ] DDoS protection enabled (Cloudflare default is enough for v1)
- [ ] Internal services not exposed to the public internet (private networking)
- [ ] CORS configured restrictively (allow-list, not wildcard)

### Audit & compliance
- [ ] Audit log of every admin action, retrievable for 12 months
- [ ] Audit log immutable (append-only; checksum-verified)
- [ ] SOC 2 control evidence captured automatically where possible
- [ ] GDPR data subject request flow (export, delete) implemented and tested
- [ ] DPA template ready for enterprise customers

---

## 2. AI / LLM Specific

### Evidence and grounding
- [ ] Every AI output with factual claims has at least one citation
- [ ] Citation references are validated against source store (no invented IDs)
- [ ] Orchestrator rejects outputs that fail citation validation
- [ ] User interface surfaces citations clearly; they're interactive, not decorative

### Cost governance
- [ ] Per-call cost cap enforced at orchestrator (hard stop at limit)
- [ ] Per-tenant monthly cap with warnings at 70/85/100%
- [ ] Per-agent cost dashboard visible to admins
- [ ] Cost anomaly alerts (>3σ from baseline triggers Slack notification)
- [ ] Model tier policy enforced; engineers cannot hardcode model strings
- [ ] Caching configured for repeated retrievals (KB lookups, embeddings)

### Quality and safety
- [ ] Hallucination sampling and review process in place (weekly cadence)
- [ ] Prompt regression evals run on every prompt change in CI
- [ ] Prompt versions tracked in git; old versions retained for replay
- [ ] LLM provider fallback chain configured and tested (primary → secondary)
- [ ] Model deprecation handling: tracked upstream changes; rollover plan documented
- [ ] No outbound customer-facing content auto-sent without explicit user approval
- [ ] Customer landing pages (CLP): publish requires AE password + explicit publish action
- [ ] CLP public routes rate-limited; visitor PII consent at identity gate
- [ ] CLP asset delivery uses token-scoped URLs only (no raw KB asset IDs on public internet)

### Observability
- [ ] Every LLM call traced: latency, tokens, cost, model, prompt version, agent
- [ ] Langfuse (or equivalent) dashboards for prompt performance
- [ ] Slow LLM call alerts (p99 above threshold pages on-call)
- [ ] Token-budget burn rate tracked and alerted

### Data flow
- [ ] No customer PII sent to LLM provider unless required (redaction first)
- [ ] LLM provider data retention configured to zero where supported (Anthropic supports this for enterprise)
- [ ] No training-data-shared flags set inadvertently
- [ ] Transcript storage location matches tenant's data residency configuration

---

## 3. Reliability

### SLO targets (v1)
- [ ] 99.5% availability during business hours documented
- [ ] Error budget tracking in place
- [ ] Incident runbook for every critical user flow

### Failure handling
- [ ] Graceful degradation paths defined for: LLM outage, vector store outage, meeting bot failure, CRM API outage
- [ ] Timeouts on every external call (no infinite waits)
- [ ] Retries with exponential backoff on transient failures
- [ ] Circuit breakers on critical downstream calls
- [ ] Idempotency keys on every state-changing API call

### Disaster recovery
- [ ] Database backups daily, retained 30 days
- [ ] Point-in-time recovery available for 7 days
- [ ] Restore procedure tested (quarterly)
- [ ] RTO documented (target: 4 hours for v1)
- [ ] RPO documented (target: 1 hour for v1)
- [ ] Off-region backup copy for production data

### Capacity
- [ ] Load tested to 2x expected v1 peak (400 concurrent calls)
- [ ] Auto-scaling configured on stateless services
- [ ] Database connection pool sized correctly
- [ ] Redis memory limits set with eviction policy

---

## 4. Performance

### Frontend
- [ ] First Contentful Paint <1.5s on 3G Fast (synthetic test)
- [ ] Largest Contentful Paint <2.5s
- [ ] Total Blocking Time <200ms
- [ ] JS bundle per route <250KB gzipped
- [ ] Bundle analyzer report reviewed; no unexpected fat dependencies
- [ ] Real User Monitoring (RUM) in place

### Backend
- [ ] API p95 latency budgets documented and met:
  - Read endpoints: <200ms
  - Write endpoints: <500ms
  - LLM-backed endpoints: documented per agent
- [ ] Database query p95 <50ms for transactional queries
- [ ] N+1 queries eliminated (manual review + tooling)
- [ ] Slow query log enabled in production; >1s queries reviewed weekly

### Live call hot path
- [ ] Transcript display <3s end-to-end
- [ ] Bot-chat response <5s p95
- [ ] Sentiment update <2s
- [ ] WebSocket reconnect <1s on transient drop

---

## 5. Observability

### Logs
- [ ] Structured (JSON) logs across all services
- [ ] Standard fields: timestamp, level, service, trace_id, tenant_id
- [ ] Centralized log aggregation (Better Stack / Axiom)
- [ ] Log retention: 30 days hot, 90 days cold, 1 year for audit logs
- [ ] PII redaction enforced in logging middleware
- [ ] No `print()` statements in production code (linter enforced)

### Metrics
- [ ] Service health metrics: request count, latency, error rate (RED)
- [ ] Infrastructure metrics: CPU, memory, disk, network (USE)
- [ ] Business metrics: calls/day, AI cost/call, AE engagement
- [ ] Dashboards in Grafana for each domain (services, business, AI)

### Tracing
- [ ] OpenTelemetry instrumentation on every service
- [ ] Trace IDs propagated across services (W3C TraceContext headers)
- [ ] Trace sampling configured (100% for errors, 5–10% for healthy traffic)
- [ ] Trace IDs included in error responses for support

### Alerting
- [ ] Alert routing configured (PagerDuty or equivalent → on-call)
- [ ] Alerts have severity (P1/P2/P3) and a runbook link
- [ ] Alert noise reviewed monthly; flaky alerts fixed or removed
- [ ] On-call rotation documented and acknowledged

---

## 6. Data

### Schema
- [ ] All migrations tested in staging before production
- [ ] Migrations are backward-compatible with the previously-deployed app version
- [ ] No destructive migrations without explicit ADR approval
- [ ] Schema drift detection in CI (compare staging vs production)

### Quality
- [ ] Foreign keys defined where relationships exist
- [ ] Indexes on every queried column
- [ ] `NOT NULL` constraints where appropriate
- [ ] Enum values constrained at DB level (Postgres enums or CHECK constraints)
- [ ] Multi-tenant data has `tenant_id` indexed on every table

### Lifecycle
- [ ] Data retention policy defined per data type (transcripts, KB, audit, etc.)
- [ ] Automated deletion of expired data (configurable per tenant)
- [ ] User data export available on request (GDPR)
- [ ] User data deletion verified to cascade properly

---

## 7. Deployment

### CI/CD
- [ ] All builds run in CI; no manual deploys
- [ ] Tests required to pass before merge
- [ ] Linting required to pass before merge
- [ ] Security scanning in CI (Snyk, GitHub Advanced Security, or equivalent)
- [ ] Dependency licenses verified in CI
- [ ] Container images signed (cosign or equivalent)

### Release
- [ ] Blue-green or rolling deployments (zero downtime)
- [ ] Database migrations decoupled from app deploys (run separately)
- [ ] Feature flags for risky changes (LaunchDarkly or open source equivalent)
- [ ] Canary deployments for high-risk releases
- [ ] Rollback tested and runbook-documented

### Environments
- [ ] At least 3 environments: dev, staging, production
- [ ] Staging mirrors production (config, data shape, scale to a reasonable degree)
- [ ] Production access limited to on-call + admins
- [ ] Secrets not shared across environments

---

## 8. Documentation

### For users (in-app)
- [ ] Help text on every non-obvious feature
- [ ] Empty states explain how to populate them
- [ ] Error messages are actionable, not vague
- [ ] Confirmation dialogs for destructive actions

### For admins
- [ ] Admin guide for tenant configuration
- [ ] Cost dashboard documentation
- [ ] Compliance and audit log retrieval guide

### For developers
- [ ] README runs locally in <30 minutes
- [ ] OpenAPI docs published and accurate
- [ ] ADRs cover every major architectural choice
- [ ] Runbooks for every critical alert

### For operations
- [ ] Incident response playbook
- [ ] On-call rotation and escalation paths
- [ ] Vendor contact list (Anthropic, Recall.ai, Clerk, etc.)

---

## 9. Legal and Compliance

- [ ] Terms of Service reviewed by legal
- [ ] Privacy Policy reviewed by legal
- [ ] Data Processing Agreement (DPA) ready for enterprise customers
- [ ] Subprocessor list maintained and disclosed
- [ ] Cookie consent banner where required (EU traffic)
- [ ] Recording consent flow legally reviewed for each jurisdiction we operate in
- [ ] AI disclosure: customers are told what's AI-generated and where
- [ ] SOC 2 Type II audit timeline planned (if pursuing)

---

## 10. Accessibility

- [ ] WCAG 2.2 AA compliance verified via automated tools (axe-core)
- [ ] Keyboard-only walkthrough completed for critical flows
- [ ] Screen reader walkthrough completed (NVDA or VoiceOver) for dashboard
- [ ] Color contrast verified across light and dark modes
- [ ] No flashing content that could trigger seizures
- [ ] Reduced-motion preference respected
- [ ] All form fields labeled
- [ ] All images have alt text or `alt=""` for decorative

---

## 11. Internationalization (v2 prep)

Not required for v1, but to avoid painting into a corner:

- [ ] No user-facing strings hardcoded in JSX
- [ ] Dates and numbers formatted via Intl APIs
- [ ] String concatenation avoided in favor of templating
- [ ] RTL-safe CSS (use logical properties: `margin-inline-start`, not `margin-left`)

---

## 12. Cost Discipline (operational)

- [ ] Monthly cost review with finance
- [ ] Cost per call, cost per AE, cost per tenant tracked
- [ ] Top cost drivers identified and quarterly optimization passes scheduled
- [ ] Idle resource detection (unused environments, old vector indexes, orphaned objects in storage)
- [ ] Reserved capacity considered for predictable workloads (Postgres, Redis)

---

## 13. The "Sales Demo Won't Embarrass Us" Check

A separate, blunt checklist for the first 100 customer demos:

- [ ] Loading states everywhere (no blank screens)
- [ ] Empty states are intentional, not "no data"
- [ ] Error states have a "Try again" or "Contact support" CTA
- [ ] Copy is plain English, no internal jargon
- [ ] No Lorem Ipsum, no placeholder names, no "test" anywhere visible
- [ ] Logo and brand consistent across every surface
- [ ] AE-perspective demo walkthrough verified <3 minutes
- [ ] Leadership-perspective demo walkthrough verified <5 minutes
- [ ] Sample data set is realistic and tells a story

---

## 14. The "We Got Acquired and Engineering Left" Resilience Check

A morbid but useful test. The platform should survive significant team turnover:

- [ ] No critical knowledge in one person's head
- [ ] Architecture documented enough for an outside engineer to understand
- [ ] Deployment is automated, not "ask Bob"
- [ ] Secrets rotation is documented
- [ ] Vendor contracts and access are recorded somewhere a survivor can find
- [ ] Code passes linting and tests for at least 6 months without intervention
- [ ] On-call playbooks cover the most common 80% of incidents

---

## How to ship

Before every production release:

1. PR reviewer verifies the checklist for new functionality
2. Release manager spot-checks the full list quarterly
3. On-call sign-off on observability and rollback readiness
4. Tag the release in git; changelog generated from commits

If any item is unchecked and unjustified, the release is blocked. The cost of fixing a production incident always exceeds the cost of waiting a day.
