# Storyline: Two Lives, Nine Modules
**Companion to:** `01_PRD.md`, and the module structure agreed in design review
**Format:** Cinematic narrative, interwoven dual-protagonist, module-mapped
**Purpose:** Walk every module of the platform through lived use, so the build follows the story rather than the other way around
**Version:** 0.1 (Draft)

---

## How to read this document

The story is told in scenes. Each scene begins with a small header showing which module is in use:

> **[M2 — Pre-Call Workspace]**

These headers exist for the design and engineering reader. Skip them on a first read; the prose is meant to flow without them.

The story is interwoven: Marcus (VP Sales) and Sarah (AE) take turns. Their threads touch but rarely intersect directly — same as in real life.

---

## Cast

**Sarah Mendes** — Account Executive, 4 years at the firm. Carries an enterprise quota in financial services. Competent, organized, occasionally exhausted. Drives discovery calls like an interview, which is both her strength and her ceiling.

**Marcus Okafor** — VP of Sales, 12 years in tech sales, 3 at this firm. Coached more reps than he can count. Skeptical of sales tools that promise more than they deliver. Has a standing 7am Monday block to plan his week.

**Tariq Ali** — Solutions Engineer on Sarah's pod. Eight months in. Quiet on calls, sharp in writing.

**Priya Raman** — Designer on Sarah's pod. Tenured, opinionated, doesn't suffer bad briefs. Appears later.

**Eleanor Hayes** — CTO at Meridian Trust, a mid-market wealth management firm. The prospect. Currently weighing three vendors. Has been burned by services firms before.

**Devika Krishnan** — Content Strategist, owns the firm's case study library. Appears in the content-owner cameo.

The product has no name in this story. The characters call it "the platform." That's deliberate.

---

## Monday, 7:02 AM — Marcus

> **[M1 — Home / Dashboard, leadership view]**

The kitchen is quiet. Marcus's wife is still asleep. The coffee machine wheezes through a second cup while his laptop boots up.

He has a ritual for Monday mornings: review last week before the week pulls him under. Before the platform existed, this meant opening Salesforce, scanning the dashboards, reading three or four call recordings Gong had flagged, and writing a list of who to spend 1:1 time with. It took ninety minutes and felt like archaeology.

The platform opens to a view he's come to trust more than he expected to.

**Last week:** 47 discovery calls across his team. 12 progressed. 6 closed-lost-no-progress. 29 still in motion.

Beneath the numbers, the section he reads first: **This week's coaching candidates.** Three names. One sentence each.

> **Sarah Mendes** — *Strong on discovery, but on three of her last four calls she let the prospect drive the timeline conversation. Worth a 1:1 on commitment-anchoring before her Meridian Trust call Tuesday.*

> **James Liu** — *Closed strong last week. Second deal in a month with a pattern of pricing pushback Wednesday-Friday. Worth understanding what he's doing differently.*

> **Anika Shah** — *New to the CIO persona. Two consecutive calls with sentiment dropping after technical pivot. Could be a pairing opportunity with Tariq next time.*

Marcus exhales through his nose. The first one is the kind of observation he might have made himself if he'd listened to all four of Sarah's calls. He hadn't. He couldn't. But the platform had, and it had been specific enough not to insult him with vagueness.

> **[M6 — Coaching & Analytics, individual scorecard drill-down]**

He clicks Sarah's name. The screen shifts: now he's looking at her individual scorecard. Three transcript moments, marked as the evidence the platform used. Not summaries. Actual lines:

> **Eleanor [Sarah's last Meridian call]:** "We're probably looking at Q3 to make a decision, but honestly, who knows with our board."
> **Sarah:** "Totally understand, boards can be tricky."

> **[Different prospect, two weeks earlier]:** "We don't really have a budget yet."
> **Sarah:** "No worries, we can figure that out as we go."

Three moments. Same pattern. Sarah accepting the prospect's softness rather than gently testing it. *Worth a 1:1 on commitment-anchoring.* He gets it.

He drags Sarah's name into a Monday 1:1 slot. The platform notes it. It doesn't push him toward any specific coaching framework. He's the coach. The platform is the eye.

> **[M2 — Pre-Call Workspace, leadership preview]**

The next thing he looks at is the Meridian Trust call on Sarah's calendar tomorrow. He's flagged it because Meridian is a $1.2M opportunity stuck in stage 2 for six weeks. He pulls up the pre-brief — leadership has a read-only preview before the AE has even opened it.

Three things catch his eye:

1. **ICP match: 0.78**, with a note that Meridian's tech stack signals were classified ambiguously. They use a competitor for one tier of their stack and the platform isn't sure whether that's a wedge-in or a wall.

2. **Anticipated objection #1: budget tension Q3 vs Q4.** Confidence flagged as medium. The platform wants him to know it's guessing.

3. **A flag he hadn't seen before:** *Tariq joining as SE. Last two calls with this prospect, technical depth scored below pod average. Consider whether Tariq has the regulatory-platform exposure this account needs, or pair with a senior SE.*

He pauses on that one. The platform is suggesting his SE might be miscast on this call. He doesn't love the suggestion — Tariq is on his team and he likes Tariq. But it's specific enough that he can't dismiss it. He pulls up Tariq's three prior calls in this vertical. The platform shows him the moments where Tariq's answers triggered follow-up clarifying questions from the prospect. A pattern.

He doesn't reassign the call. Instead, he forwards the pre-brief to Tariq with a one-line note: *"Worth reviewing the regulatory section in detail before Tuesday. Happy to talk through it if useful."*

It's 7:34 AM. He moves on.

---

## Monday, 9:47 AM — Devika

> **[M5 — Knowledge Base, content-owner admin view]**

Devika has been doing this job for six years and used to spend Monday mornings auditing the firm's case study library by hand. Now the platform does that for her. She still does the audit, but it takes twenty minutes instead of three hours.

Her view opens to a list she calls *the watchlist.* Twelve assets the platform has flagged this week, each with a reason.

> **"Whitlock Capital Modernization (2023)"** — *Used in 14 calls this quarter. Cited in 9 progressions. Strong asset. No action needed.*

> **"Legacy System Integration Playbook (2022)"** — *Hasn't been used in any call in 90 days. Recommend deprecate or refresh. Last reviewed 14 months ago.*

> **"Mid-Market ESG Compliance Brief (Draft)"** — *Auto-drafted by content generation agent following 3 calls last week mentioning ESG regulatory pressure. Awaiting your review.*

She opens the third one. The draft is rough — the platform isn't pretending it's polished. But it's structured: opening framing, three customer pain points pulled from real transcripts (anonymized), a solution outline, a placeholder for the proof points she'd need to add. It would take her maybe ninety minutes to turn this into something she'd ship.

> **[M8 — Content Generation Studio]**

She clicks through to the studio view. This is where draft assets live before they're real. The studio shows her the chain of evidence: which calls triggered this draft, which pain language repeated, which prospects asked for something the library didn't have. Three transcripts, anonymized. One of them is Sarah's last Meridian call.

She skims them. The platform isn't wrong — ESG regulatory pressure is showing up across her FS-vertical accounts and the library doesn't have a good asset for it. She doesn't approve the draft outright. She edits the opening, marks two paragraphs for rewriting, and routes it back to the platform as *needs work, priority high.* The platform notes the priority. The next time an FS call surfaces an ESG question, it'll know there's a draft in progress and won't generate a duplicate.

She closes the laptop. Coffee.

---

## Monday, 11:33 AM — Marcus

> **[M9 — Governance Layer]**

A Slack ping from his head of legal. *"Quick — the AI cost numbers for Q3 board prep. Where do I find them?"*

Marcus opens the platform's governance surface. He doesn't come here often — once a month, when finance or legal pings him. It's quiet. Functional. Not a dashboard for daily use.

Three sections. **Audit log.** **Compliance posture.** **AI cost & policy.**

He pulls up AI cost. The view defaults to the current quarter.

- Total AI spend Q3-to-date: $47,200
- Per-call average: $3.18
- Per-AE monthly: $620
- Most expensive operation: weekly win-loss analysis (acceptable; runs at scale)
- Cheapest agent: live keyword extraction (running on the cheap-tier model; correctly)
- Cost-cap incidents this quarter: 2 (both auto-handled; AE notified, work queued)

He screenshots the summary, pastes it into Slack with a one-liner. Done.

Below the cost view, the audit log shows him an event he hadn't seen — last Friday, his head of customer success exported a tenant's data via the GDPR export tool. The platform logged it with the time, the requester, the data scope, the recipient. Marcus doesn't need to act on it. He just needed to know the log was working. He nods and closes the surface.

---

## Monday, 4:18 PM — Sarah

> **[M1 — Home / Dashboard, AE view]**

Sarah is between calls — a quick one with a low-fit lead that lasted seven minutes and ended in a polite no — when she sees Marcus's 1:1 invite for tomorrow morning. The subject line is "Pre-Meridian sync." The agenda is one line: *"Quick chat about commitment-anchoring. 20 min."*

She tilts her head. Marcus rarely puts 1:1s on her calendar without context. Either she's done something noteworthy or she's about to be coached. Both have happened before.

She opens the platform. Her home view shows her: today's two remaining calls, tomorrow's Meridian call at 9 AM, three drafts awaiting her approval, and — new — a small banner: *"Coaching context for your 1:1 with Marcus tomorrow."*

She clicks it.

> **[M6 — Coaching & Analytics, AE-facing transparency view]**

Three call moments are highlighted under a section labeled *"This is what Marcus wants to discuss."* She reads them.

The first one is from the Meridian call two weeks ago. *"Totally understand, boards can be tricky."* She remembers the moment. Eleanor had been waffling on timeline, and Sarah had decided that pushing on it would feel pushy. She'd let it slide. The platform thinks she let it slide three times in a row across different calls.

A small footer on the panel: *"This is what Marcus is going to bring up. You can think about it before the 1:1, or not."*

She thinks about it. The platform isn't wrong, but it isn't quite right either. With Eleanor, the timeline waffle hadn't felt like an opening to push — it had felt like a board-process reality. Pushing would have meant pretending she didn't believe a CTO about her own board. But maybe — and Sarah catches herself here — maybe she'd extrapolated that to two other calls where the situation wasn't the same at all.

She types a note in her prep doc: *"Marcus is right about Whitlock and the Cardinale call. I think he's only half-right about Meridian. Will say so."*

She closes the laptop. Tomorrow is a big day.

---

## Tuesday, 7:51 AM — Sarah

> **[M2 — Pre-Call Workspace]**

The Meridian call is at 9 AM. Sarah's pre-call ritual starts ninety minutes ahead because she's superstitious about feeling rushed. Coffee, kitchen table, dog at her feet, the platform open on her laptop.

The brief is already there. It was generated yesterday at 5 PM and refreshed at 7:30 AM after Eleanor's calendar was updated.

She reads the **Account Snapshot** first. Most of it she already knows — Meridian Trust, mid-market wealth management, $4.2B AUM, 340 employees, Boston-based, regulated under SEC and state-level frameworks. She's read this twenty times across six weeks. The platform has added one new thing: *"Meridian filed an updated Form ADV last Thursday, reflecting an expansion into ESG-focused mandates. This isn't in prior briefs."*

She didn't know that. She wouldn't have known that. The platform picked it up from a public SEC feed and flagged it because it potentially shifts what Eleanor's platform needs to support. She makes a mental note to bring it up at the right moment, naturally, the way you'd reference a news article you happened to have read.

She moves to **Persona Profile.** Eleanor Hayes, CTO, 14 years at Meridian, promoted to CTO 3 years ago. Background in financial systems architecture. Published two articles in 2023 about the regulatory burden on mid-market firms. The platform notes: *"Eleanor's communication style across prior calls scores high on direct-questioning and low on small-talk tolerance. Average warm-up under 90 seconds in prior calls."*

She's run two calls with Eleanor. The platform is right. Eleanor gets to the point.

**Hypothesized Pains.** Three of them, each with a confidence score.

1. *Regulatory reporting velocity (0.91).* Eleanor has mentioned this in both prior calls.
2. *Data fragmentation across legacy systems (0.84).* Inferred from her articles + Meridian's tech signals.
3. *Cost pressure from CFO on platform spend (0.62).* Lower confidence. Inferred from a single offhand comment.

She reads the third one twice. The platform is telling her: *here's a thing I think might be true, here's how thin my evidence is, you decide whether to act on it.* That calibration is what she needs from a tool. The previous version of "AI insights" she'd seen at her last job would have stated the cost-pressure pain as if it were established fact, and she would have walked into a call confidently mentioning the CFO and gotten a confused look in return.

**Anticipated Objections.** The platform lists three. The first one is about timeline — exactly the thing she'd been thinking about since reading Marcus's coaching note. The platform suggests:

> *Eleanor is likely to repeat the Q3 board-decision framing. Consider acknowledging the board reality, then asking specifically: "When you bring this to the board, what are the two or three things that have to be true for it to land?" This converts a soft timeline into a discovery question.*

Sarah reads that suggestion twice. It's good. Not because she couldn't have come up with something like it herself, but because she hadn't. The platform isn't writing her script. It's giving her a move she can choose to use or not. She'll use it.

**Recommended Deck.** The platform has assembled a 9-slide deck from the firm's existing library. She scrolls. Slides 1 through 4 are familiar. Slide 5 is one she hasn't seen — a case study of a $2.8B AUM firm in Connecticut that went through a similar modernization. *"Used in 14 prior calls; correlated with progression in 9 of 14 with mid-market FS prospects."* The platform isn't telling her it's the right slide. It's telling her it's the slide that worked.

> **[M5 — Knowledge Base, contextual lookup from M2]**

She clicks the slide title to see the full case study. The KB opens in a side panel. She reads the one-page summary in twenty seconds, decides it's the right fit, and goes back to the deck assembly. She approves the deck. She removes slide 3, which is corporate-style and Eleanor will hate. The platform notes the removal without protest.

**Pod-specific notes.** She scrolls to Tariq's section. The platform shows her a single sentence: *"Tariq, regulatory reporting is the primary pain. Be ready to discuss specific filing workflows (Form ADV, 13F) rather than generic compliance architecture."* Below it: *"Tariq has reviewed this brief at 8:14 AM."*

Good. He's seen it. The platform handling pod-readiness without her babysitting is a small thing that adds up across a week.

She closes the brief. It's 8:24 AM. Time to get ready.

---

## Tuesday, 8:58 AM — Marcus

> **[M1 — Home / Dashboard, mobile, live calls strip]**

Marcus is in his car, parked outside his daughter's school, finishing a piece of toast. His daughter has just walked in. He opens the platform on his phone and looks at the live calls strip on his home view.

Sarah's Meridian call is starting in two minutes. He doesn't open it. He's not going to listen — he never does in real-time, that's not what leadership-watching-live is for. He just notes it's on. He'll see the scorecard in three hours.

He closes the phone and pulls out of the parking lot.

---

## Tuesday, 9:01 AM — Sarah

> **[M3 — Live Call Cockpit]**

The meeting bot joins the call as Sarah does, with a small announcement that the call will be recorded for note-taking. Eleanor nods on screen — she's already agreed to this in prior calls. Tariq is in his home office, camera on, looking like he didn't sleep enough but didn't have to.

Sarah's screen is split. On the left, her Zoom window with Eleanor and Tariq. On the right, the platform's live call cockpit.

She opens with her warm-up — under 60 seconds, just like the brief said. Eleanor thanks her for the calendar reschedule last week. The cockpit on the right is quiet. It's not generating noise during pleasantries.

Sarah pivots: "Eleanor, I noticed Meridian filed an updated Form ADV last Thursday — the ESG mandate expansion. Congratulations on that, by the way. I'd love to understand how that's shifting how you think about the platform modernization."

The cockpit's signal panel lights up briefly: a small green indicator showing it recognized the move as an *intentional discovery anchor.* Sarah doesn't look at it. She's looking at Eleanor.

Eleanor's expression changes by a small degree. The kind of change that means *you did your homework, and I noticed.* "That's a good question. Honestly, it's the reason we're moving faster on this than we were two months ago. The ESG reporting requirements are going to break our current setup within a year. So timeline matters more than it did when we last talked."

The cockpit shows a small notification on Sarah's screen: *Timeline signal detected. Eleanor introduced urgency without prompting.* Sarah ignores it because she's already heard it — she doesn't need the AI to tell her what she's hearing.

The conversation moves. Eleanor describes the ESG reporting load in technical terms. Tariq engages, asking about specific data sources. The cockpit's transcript panel scrolls live, with keyword highlighting. The phrase *"continuous compliance"* gets highlighted in yellow. Sarah glances at it. A small popover appears on hover: *"Continuous compliance — a regulatory framework where compliance status is monitored in real-time rather than at periodic audits. Used in 9 of our case studies; we have a 2024 webinar deck if relevant."*

She doesn't click. She doesn't need it. But knowing it's there means if Tariq goes a direction she can't follow, she has an exit ramp.

Around minute 19, Eleanor says the line both Sarah and the platform were waiting for: "We're probably looking at Q3 to bring this to the board, but you know how boards are."

Sarah breathes once. The cockpit surfaces a soft nudge in her panel:

> *Suggested move: ask what has to be true for the board.*

She doesn't need the reminder, but she appreciates the timing. It's there, gentle, in case she needs it. She uses her own version:

"That's helpful to know, Eleanor. Just so I can be useful — when you bring something like this to the board, what are the two or three things that have to be in place for them to say yes? I want to make sure we're shaping our proposal toward what they'll actually be evaluating."

Eleanor pauses. The sentiment indicator ticks up half a notch — interest, not defensiveness. *"Honestly? They need to see the regulatory liability quantified. They'll want a phased cost structure. And they're going to ask about reference customers who've been live for at least 18 months."*

Sarah writes this down even though the platform is also writing it down. There's something about writing it yourself that makes it stick.

The cockpit discreetly logs three new BANT signals: *budget framework signal, authority structure signal, regulatory pain quantification.* Sarah doesn't see these annotations during the call — they'll show up in the post-call brief.

Around minute 31, Tariq stumbles. Eleanor asks about how the platform handles *intraday position reconciliation across multiple custodians* — a specific technical scenario. Tariq's answer is competent but generic. Sarah can see Eleanor's face shift. Tariq can probably see it too on his own screen.

The cockpit routes a nudge to Tariq's panel — not Sarah's. Sarah will only learn about this later, but on Tariq's screen, a panel surfaces a 2-sentence summary of a case study where the firm solved exactly this problem for a Boston-based hedge fund, with a link to a one-page reference architecture. Tariq reads it in the four seconds Eleanor is finishing her question.

He recovers: "Actually, let me be more specific. We have a reference architecture for this — we did this for a Boston hedge fund last year. The pattern was X, Y, Z."

Eleanor's face shifts back. *Okay, you've actually done this.* Sarah relaxes a fraction.

The call ends at minute 47, three minutes early. Eleanor has agreed to a follow-up next Tuesday, with two named board members joining for the second half.

Sarah closes the Zoom window.

---

## Tuesday, 9:51 AM — Sarah

> **[M4 — Post-Call Review]**

The post-call view loads. The platform takes about forty-five seconds to populate it. Sarah waits without minding.

At the top: a single sentence the platform calls the *headline.*

> **Strong call. Eleanor introduced board-readiness language for the first time. Two named decision-makers joining next call. Recommended next step: send case study with 18-month customer reference, request named follow-up by Thursday.**

Below it, the **AI summary**. Two paragraphs. Sarah skims. Accurate.

Below that, the **Drafted follow-up email.** Already in her voice — the platform has learned her phrasing from the 38 emails she's approved this quarter. The opening line reads: *"Eleanor, thanks for the time this morning, and congratulations again on the ADV filing."* Sarah laughs a small laugh. She would have written exactly that. She reads the rest. It's close, but the third paragraph mentions a case study that the platform thinks she should include. She agrees. She would have remembered to include it, but the platform remembered first. She approves the draft with one edit: changing "phased cost structure" to "phased investment plan" because Eleanor doesn't talk about cost, she talks about investment. The platform notes the edit silently.

Below the email: **CRM tasks created.**

- *Send case study to Eleanor (Tuesday EOD) — drafted.*
- *Confirm board attendees for next call (Thursday) — needs your action.*
- *Internal: pair Tariq with senior SE for next call (Thursday review) — flagged for your manager.*

She pauses on the third one. She hadn't asked for that. The platform created it because the pod scorecard for this call had a flag on Tariq's technical depth. She debates for a moment whether to remove the task. Then she doesn't. She trusts the call.

**Pod scorecard.** Three rows:

- *Sarah: strong (0.86). Strengths: anchored discovery on board-readiness, used acknowledged objection technique well. Watch: still occasionally trails off on commitment moments, pattern flagged for coaching context.*
- *Tariq: developing (0.71). Strong recovery mid-call. Watch: initial response to intraday reconciliation question generic; reviewing this with sales engineering manager.*
- *Pod overall: strong (0.81). Recommended for next stage.*

The note about Tariq is honest, not punitive. It says *developing,* not *failed.* Sarah likes that. She's been on platforms that pretended to coach but actually just scored.

**What the platform learned.** A small section Sarah has come to like. The platform notes that this call updates several of its prior assumptions:

- *Cost-pressure pain (was 0.62) — downgraded to 0.45. Eleanor framed this as investment, not cost.*
- *Timeline pain (inferred) — upgraded to confirmed. Q3 board decision with named members.*
- *New signal: ESG regulatory pressure is the urgency driver.*

It's a small thing, but it tells Sarah the platform isn't trying to look smarter than it is. It's openly updating. The product feels like a colleague who admits when they were wrong.

She closes the laptop. It's 9:58 AM. Her next call is at 10:30. She walks the dog.

---

## Tuesday, 2:14 PM — Priya

> **[M7 — Settings & Admin, AE-side preference settings]**

Priya, the design pod-mate, hasn't been on a call today but is doing housekeeping. She opens her settings, the second tab, "Notifications," because the platform has been pushing her too many proactive nudges during calls and she wants to throttle them.

The settings view is mostly self-explanatory. Three sliders.

- **Nudge frequency during calls:** *3 per 5 minutes (current). She drags it down to 2.*
- **Quiet during customer speech:** *On.*
- **Role-specific cues only:** *On. She'd already done this.*

Below the sliders, a small note: *"Your previous settings led to 47 nudges across 23 calls. You acted on 19 of them. Acceptance rate: 40%. Below team median (54%). You may want to increase signal threshold rather than reduce frequency."*

She reads that twice. The platform is gently telling her the issue isn't volume, it's relevance. She undoes the slider change. Instead, she clicks into a second view: *Customize nudge types.* She turns off "objection handler reminders" (she always handles those herself) and turns on "design-pattern reference surfacing" with higher priority. The platform notes the change.

She moves on with her afternoon.

---

## Friday, 11:14 AM — Marcus

> **[M6 — Coaching & Analytics, weekly rollup]**

Marcus is in his Friday afternoon block, the one he keeps blocked off for nothing in particular, which always fills with something. Today it's a review of the week's progressions.

The platform shows him: 12 calls progressed this week. Among them, Sarah's Meridian call. He clicks into Sarah's call summary. Reads the headline. Reads the scorecard. Watches the 6-minute auto-highlighted call summary, six moments the platform thought mattered.

The board-readiness move at minute 23 is the third highlight. He pauses on it. Sarah ran the move the way he would have wanted her to run it. The platform notes, almost as a footnote: *"This pattern (anchoring board readiness) was flagged for coaching in Sarah's 1:1 context this week. Observed in this call without intervention."*

Marcus reads that twice. The platform is telling him: *the coaching prompt I gave you on Monday, the thing you and Sarah talked about, landed.*

He doesn't act on it. He doesn't need to. He just notes it. Sarah's coaching loop closed this week. She's becoming a slightly better AE because of a small specific thing he asked her to work on, which he had only noticed because the platform showed him a pattern across three calls.

> **[M6 — Coaching & Analytics, win-loss pattern view]**

He scrolls to the bottom of the weekly view. A new section he's been getting used to: *Patterns emerging this quarter.*

The platform shows him three:

1. *Mid-market FS prospects with ESG mandate exposure are converting 22% faster than the segment average. Three of his AEs have closed in this micro-segment this quarter. Pattern strength: high.*
2. *Calls where the SE recovers from a technical stumble (defined as a generic answer followed by a specific one within 30 seconds) score 18% higher overall than calls without a stumble at all. Counterintuitive; flagged for human review.*
3. *Anika's CIO calls are improving. Sentiment-drop pattern from earlier this quarter has resolved in her last two calls. No pairing needed; she figured it out.*

Marcus reads the second pattern three times. *Calls with a stumble-and-recovery score higher than calls with no stumble.* He's not sure he believes it. But the platform is showing him the evidence: 47 calls in the sample, the score deltas, the confidence interval. He doesn't have to believe it to file it away. He'll watch for it.

He closes the laptop. His daughter's recital is at 5.

---

## Coda: Where the modules touched

This is the part of the document the design and engineering audience reads carefully. The narrative above touches every module of the platform. Below is the map of where, why, and what surfaced.

### Module appearances

| Module | Scene(s) | What was used |
|---|---|---|
| **M1 — Home/Dashboard** | Marcus Mon 7:02 (leadership), Sarah Mon 4:18 (AE), Marcus Tue 8:58 (mobile live strip) | Coaching candidates list, today's calls, drafts awaiting, live calls indicator |
| **M2 — Pre-Call Workspace** | Marcus Mon 7:34 (leadership preview), Sarah Tue 7:51 (full brief) | Account snapshot, persona, BANT, hypothesized pains with confidence, objections with framing, recommended deck, pod-specific notes |
| **M3 — Live Call Cockpit** | Sarah Tue 9:01 | Live transcript, keyword highlighting with popover definitions, sentiment timeline, signal log, proactive nudges (role-routed), bot-chat available (not used in this scene) |
| **M4 — Post-Call Review** | Sarah Tue 9:51 | Headline, AI summary, drafted email with style-learning, CRM tasks (incl. auto-flagged internal task), pod scorecard, "what the platform learned" updates |
| **M5 — Knowledge Base** | Devika Mon 9:47 (content owner), Sarah Tue 8:24 (contextual lookup from M2) | Asset watchlist with usage/effectiveness flags, asset detail view with case study summary, deprecation candidate flagging |
| **M6 — Coaching & Analytics** | Marcus Mon 7:14 (individual scorecard), Sarah Mon 4:18 (AE-facing coaching transparency), Marcus Fri 11:14 (weekly rollup, win-loss patterns) | Individual scorecards with transcript evidence, AE-facing transparency into upcoming coaching topics, weekly team rollup, win-loss pattern emergence |
| **M7 — Settings & Admin** | Priya Tue 2:14 | Notification preferences, nudge frequency, customize nudge types, with platform commentary on user's own usage patterns |
| **M8 — Content Generation Studio** | Devika Mon 9:47 | Draft asset awaiting review, evidence chain to source calls, priority routing back to the agent |
| **M9 — Governance Layer** | Marcus Mon 11:33 | AI cost dashboard, audit log, cost-cap incident history |

### Five product decisions the story pressure-tested

The story reads like fiction, but each scene is doing structural work. These are the moments where the product made a decision worth examining:

**1. The AE-facing coaching transparency surface (M6, Sarah's Monday afternoon).**
The platform showed Sarah what Marcus was going to bring up *before* the 1:1. This was a deliberate choice. Coaching tools historically hide insights from the coached person, which makes 1:1s feel like ambush. Showing Sarah the transcript moments in advance turned the 1:1 into a conversation, not a verdict. Sarah was able to come prepared with her own counterposition (*"I think Marcus is only half-right about Meridian"*). The risk: AEs gaming the system by preparing rebuttals to every coaching prompt. The mitigation in design: coaching prompts are surfaced as *patterns,* not verdicts, so the conversation is genuine.

**2. The platform learning out loud (M4, "what the platform learned").**
The post-call view shows Sarah which of its prior assumptions just changed. This is unusual. Most AI products hide their uncertainty to look smarter. Showing the updates makes the product feel honest. The cost: users sometimes lose confidence when they see the AI was confidently wrong before. The mitigation: only surface updates where the platform now has higher confidence than before, not arbitrary changes.

**3. Role-routed nudges with privacy (M3, Tariq's mid-call recovery).**
The platform routed a technical reference to Tariq's panel without surfacing it to Sarah. This preserved Tariq's dignity and let him recover gracefully. If the nudge had gone to Sarah, she might have intervened, and Tariq would have felt managed. The design implication: pod members see only their own nudges during the call. They see all nudges in the post-call review, with the role-routing visible. This makes the routing accountable without making it surveillance.

**4. Auto-created internal tasks without AE permission (M4, the "pair Tariq with senior SE" task).**
Sarah noticed this task. She debated removing it. She didn't. The product made a deliberate choice to *not* require AE permission for internal-only tasks routed to managers. The reasoning: if AEs could block tasks that flag pod-development needs, the platform would learn to be quiet about them, which would defeat the purpose. The risk: AEs feel surveilled. The mitigation: the task is visible to the AE, with the evidence shown. Sarah knew exactly why it existed and could see what triggered it.

**5. Counterintuitive pattern flagging (M6, Marcus's Friday).**
The platform showed Marcus that calls with a "stumble-and-recovery" score higher than calls with no stumble at all. This is the kind of pattern that no AE would notice and no leader would have time to discover. The risk: the platform surfaces a spurious correlation and a manager acts on it. The mitigation: every pattern is shown with sample size, evidence, and confidence interval. Marcus didn't have to believe it. He filed it away to watch.

### Five friction points worth designing for

The story also surfaced friction the design hasn't fully resolved:

1. **Sarah ignored several in-call nudges because she'd already noticed what the platform was telling her.** This is success, not failure. But the platform doesn't currently distinguish "user was already ahead of me" from "user disagreed" from "user didn't see it." All three look like ignored nudges. The platform's learning loop probably penalizes nudges that should be praised. Design implication: explicit post-call feedback on nudges, with low-friction tagging (already-knew / used / disagreed / didn't see).

2. **The post-call headline is the single most-read thing in M4.** If it's wrong, the entire post-call surface loses credibility. There's no current design for *how the headline gets corrected when it's wrong,* or for how a wrong headline propagates downstream (into the drafted email, the CRM task, the scorecard).

3. **The "what the platform learned" section is interesting to Sarah but probably overwhelming to a new user.** First-week AEs would benefit from a simpler post-call view. There's no current design for *progressive disclosure* of the post-call review by user tenure.

4. **Pod performance scorecards are visible across pod members.** This works in Sarah's healthy team. It would be poison in an unhealthy one. The product currently doesn't have configurable visibility on scorecards. It's a tenant-wide setting that admins can flip but pod-level can't.

5. **Devika's draft-asset review loop closes the content gap, but slowly.** A pain point can show up in three calls before a draft is generated, and then the draft sits in M8 for a content owner to find. There's no current design for *what happens during the wait.* Does Sarah's next ESG conversation still have no asset to draw on?

These aren't blockers. They're the next layer of design work. They surfaced because the story walked through the actual modules instead of staying abstract.

---

## What this story doesn't yet test

The story focused on a single successful call across a single week. It deliberately did not test:

- **The unhappy path.** What does M4 look like when a call goes badly? What happens to the drafted email when the customer was hostile?
- **A new user's first week.** Sarah is a tenured user; the product feels native to her. The story doesn't pressure-test onboarding.
- **Pod conflict.** Tariq's "developing" score is visible to him and Sarah. What if they disagreed with it?
- **Customer revocation.** Eleanor agreed to recording. What if next Tuesday she revokes consent?
- **A failure mode in the live call.** What if the bot drops mid-call? What if the LLM goes down?
- **Cross-tenant data accidents.** Marcus's governance view was clean. The story didn't put it under stress.

Each of these deserves its own story. Each will surface a layer of design that this one didn't.
