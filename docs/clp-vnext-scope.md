# Customer Landing Page (CLP) — vNext Scope

**Status:** In development  
**Replaces (partially):** PRD v1 "customer-facing surfaces out of scope" ([01_PRD.md](../01_PRD.md) §3)

## Product scope

- **Customer landing page** — password-protected, personalized lead hub after Post-DC wrap-up
- **TCS quick proposal** — structured proposal from BANT, timeline, and call context (not full SOW)
- **Visitor identity** — name + work email on each visit; activity attributed per visitor
- **Engagement analytics** — link opens, document/proposal views, dwell time, chat, comments
- **AE notifications** — in-app alerts when visitors engage (no auto-send to customer)
- **Org analytics** — leadership funnel and content performance across landing pages

## Approval and safety rules

1. **Publish is explicit** — AE must publish; nothing goes public from wrap-up alone.
2. **Client-safe copy** — all public text passes shared sanitizer (no BANT jargon, Jira, coaching, internal scores).
3. **Proposal pricing** — KB-grounded or explicit TBD; no hallucinated dollar amounts.
4. **Visitor PII** — consent shown at identity gate; retention per tenant policy; audit on AE access to visitor list.
5. **Assets** — only KB assets on the CLP allowlist; token-scoped signed URLs for public delivery.
6. **Password** — set at publish; rate-limited verification; rotatable without changing share token.

## Production checklist additions

See [08_Production_Checklist.md](../08_Production_Checklist.md) — CLP items:

- Public routes in allow-list with rate limiting
- No outbound customer email auto-sent from CLP
- Visitor event log append-only
- AE notification debouncing for high-frequency page views
