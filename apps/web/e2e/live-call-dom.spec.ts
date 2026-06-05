import { test, expect } from "@playwright/test";

test.setTimeout(120_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CALL_ID = `frontera-franchise-group-e2e-${RUN_ID}`;
const ACCOUNT_NAME = `Frontera Franchise Group E2E ${RUN_ID}`;
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const INTERNAL_SECRET =
  process.env.PLAYWRIGHT_INTERNAL_SECRET ??
  process.env.INTERNAL_SECRET ??
  "change_me_to_a_long_random_string";
const TENANT =
  process.env.PLAYWRIGHT_TENANT_ID ??
  process.env.NEXT_PUBLIC_AUTH_BYPASS_USER_ID ??
  "local-dev-user";
const USER = process.env.PLAYWRIGHT_USER_ID ?? TENANT;

const KEY_SEGMENTS = [
  {
    text: "For budget we carved four hundred fifty to six hundred thousand for year one — board blesses it in May.",
    speaker_role: "customer",
    offset_seconds: 95,
  },
  {
    text: "Timeline-wise we want a Q3 pilot with ten franchisees — production go-live by Q1 next year.",
    speaker_role: "customer",
    offset_seconds: 108,
  },
  {
    text: "Operators live in spreadsheets — manual compliance audits bottleneck us before expansion.",
    speaker_role: "customer",
    offset_seconds: 68,
  },
];

async function postDemoSegment(
  request: import("@playwright/test").APIRequestContext,
  segment: { text: string; speaker_role: string; offset_seconds: number },
  callId = CALL_ID
) {
  const url = `${API_BASE}/api/v1/webhooks/recall/demo-segment?call_id=${callId}&tenant_id=${TENANT}&user_id=${USER}`;
  const res = await request.post(url, {
    data: {
      text: segment.text,
      speaker_role: segment.speaker_role,
      offset_seconds: segment.offset_seconds,
      provider_event_id: `e2e-${callId}-${segment.offset_seconds}-${Date.now()}`,
    },
  });
  expect(res.ok(), `demo-segment failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as {
    checklist?: {
      bantCoverage?: number;
      bant?: Record<string, string>;
      items?: Array<{ id?: string; evidence?: Array<{ value?: string; snippet?: string }> }>;
    };
    ws_messages?: unknown[];
  };
  expect(body.checklist).toBeTruthy();
  return body;
}

async function seedE2eCall(
  request: import("@playwright/test").APIRequestContext,
  callId = CALL_ID,
  accountName = ACCOUNT_NAME
) {
  let lastStatus = 0;
  let lastText = "";
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await request.post(`${API_BASE}/dc-notes/ingest`, {
      headers: {
        "X-Internal-Secret": INTERNAL_SECRET,
        "x-user-id": USER,
        "x-tenant-id": TENANT,
      },
      data: {
        kind: "pre-dc",
        records: [
          {
            id: `pre-${callId}`,
            fields: {
              "Company Name-PreDC": accountName,
              "Lead Name-PreDC": "Marcus Rivera",
              "Prospect's Persona": "Chief Financial Officer",
              "Industry - PreDC": "Franchise operations",
              "Campaign Service - PreDC": "AI operations platform",
              "ICP Bucket": "Enterprise desirable",
              "Annual Revenue - PreDC": "$180M",
              "No. of Employees - PreDC": "950",
              "Have they described their needs":
                "Reduce manual compliance audits and standardize franchisee operations before a Q3 pilot.",
            },
          },
        ],
      },
    });
    if (res.ok()) return;
    lastStatus = res.status();
    lastText = await res.text();
    if (lastStatus !== 503) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  expect(false, `seed call failed: ${lastStatus} ${lastText}`).toBeTruthy();
}

test.describe.configure({ mode: "serial" });

test.describe("Live call cockpit — DOM + API", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API_BASE}/health`);
    expect(health.ok(), "API must be running on :8000 with DEMO_TRANSCRIPT_REPLAY=true").toBeTruthy();
    await seedE2eCall(request);
  });

  test("BANT, checklist, intent, and keywords update in the UI", async ({ page, request }) => {
    await page.goto(`/calls/${CALL_ID}/live`, { waitUntil: "domcontentloaded" });

    await expect(page.locator(`a[href="/calls/${CALL_ID}"]`).first()).toBeVisible({
      timeout: 20_000,
    });

    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    const playDemo = page.getByRole("button", { name: /Play demo transcript/i });
    await expect(playDemo).toBeEnabled({ timeout: 10_000 });
    await playDemo.click();

    await expect(
      page.getByText(/Manual brand-standard audits|bottleneck before/i).first()
    ).toBeVisible({
      timeout: 60_000,
    });
    const assistantCards = page.getByTestId("live-assistant-card");
    const customerIntentCard = assistantCards.filter({ hasText: /Customer intent:/i }).first();
    await expect(customerIntentCard).toBeVisible({ timeout: 45_000 });
    await expect(customerIntentCard).toContainText(
      /Pain exposed|Decision risk|Buying confidence|Evaluating fit|Listening mode/i
    );
    await expect(customerIntentCard).not.toContainText(/Customer raised:/i);
    await expect
      .poll(async () => {
        const cardTexts = (await assistantCards.allInnerTexts()).map((text) =>
          text.replace(/\s+/g, " ").trim().toLowerCase()
        );
        return new Set(cardTexts).size === cardTexts.length;
      })
      .toBeTruthy();

    const sentimentSection = page.getByTestId("sentiment-section");
    const customerTile = sentimentSection.locator('[data-sentiment-label="customer"]');
    const repToneTile = sentimentSection.locator('[data-sentiment-label="sales-rep"]');
    await expect(sentimentSection).toContainText("Customer");
    await expect(sentimentSection).toContainText(/Sales rep tone/i);
    await expect(sentimentSection).toContainText(/Recommended move/i);
    await expect(sentimentSection).not.toContainText(/\bAE\b/);
    await expect(page.locator("body")).not.toContainText(/\bAE\b/);
    await expect(customerTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect(customerTile).toContainText(
      /Pain exposed|Decision risk|Buying confidence|Evaluating fit|Listening mode/i
    );
    await expect(repToneTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect(repToneTile).toContainText(
      /Empathetic discovery|Focused discovery|Steady delivery|Needs reset|Confident support/i
    );
    await expect
      .poll(async () => {
        const bodyText = await page.locator("body").innerText();
        const salesRepToneLines = bodyText
          .split(/\n/)
          .filter((line) => /Sales rep tone/i.test(line));
        return salesRepToneLines.join("\n");
      })
      .not.toMatch(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect
      .poll(async () => {
        const bodyText = await page.locator("body").innerText();
        const customerSentimentLines = bodyText
          .split(/\n/)
          .filter((line) => /Customer sentiment:/i.test(line));
        return customerSentimentLines.join("\n");
      })
      .not.toMatch(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect
      .poll(async () => sentimentSection.innerText(), { timeout: 45_000 })
      .toMatch(/Customer\s+(Pain exposed|Decision risk|Buying confidence|Evaluating fit|Listening mode)/i);

    await expect(page.getByText(/budget|four hundred|six hundred|carved/i).first()).toBeVisible({
      timeout: 90_000,
    });

    await expect(page.getByText(/BANT live/i).first()).toBeVisible();
    await expect
      .poll(
        async () => {
          const text = await page.locator("body").innerText();
          const match = text.match(/BANT coverage at\s*(\d+)%|(\d+)%\s*BANT/i);
          return match ? Number(match[1] ?? match[2]) : 0;
        },
        { timeout: 90_000 }
      )
      .toBeGreaterThan(0);

    await expect(page.getByText(/Running summary/i).first()).toBeVisible({
      timeout: 15_000,
    });

    await expect(page.getByText(/Primary intent|Latest pain signal/i).first()).toBeVisible();
    await expect(
      page.getByText(/commercial|timeline|budget|discovery|focus/i).first()
    ).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/\bif\s*×|\bso\s*×|\bthey\s*×/i);
    expect(bodyText).toMatch(/budget|franchise|pilot|q3|platform|compliance/i);

    const lastSegment = await postDemoSegment(request, {
      text: "We need board approval on budget before Q3 pilot kickoff.",
      speaker_role: "customer",
      offset_seconds: 120,
    });
    expect((lastSegment.checklist?.bantCoverage ?? 0) > 0).toBeTruthy();
    const bant = lastSegment.checklist?.bant ?? {};
    expect(["partial", "confirmed"]).toContainEqual(bant.budget);
    expect(["partial", "confirmed"]).toContainEqual(bant.authority);
    expect(["partial", "confirmed"]).toContainEqual(bant.timeline);

    const authorityItem = lastSegment.checklist?.items?.find((item) => item.id === "authority");
    const authorityEvidence = authorityItem?.evidence?.at(-1);
    expect(authorityEvidence?.value?.toLowerCase()).toContain("board");
    expect(authorityEvidence?.value).not.toMatch(/ai-native platform|dashboard/i);

    const bantLiveSection = page.getByTestId("bant-live-section");
    await expect(bantLiveSection).toContainText(/Authority/i, { timeout: 25_000 });
    await expect(bantLiveSection).toContainText(/board/i, { timeout: 25_000 });
    await expect(bantLiveSection).not.toContainText(/AI-native platform to/i);
  });

  test("API demo-segment updates BANT checklist", async ({ request }) => {
    test.setTimeout(60_000);
    const out = await postDemoSegment(request, KEY_SEGMENTS[0]);
    expect(out.checklist?.bant?.budget).toBeTruthy();
    expect((out.checklist?.bantCoverage ?? 0) > 0).toBeTruthy();
  });

  test("API timeline ETA segment appears in BANT timeline UI", async ({ page, request }) => {
    await page.goto(`/calls/${CALL_ID}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/calls/${CALL_ID}"]`).first()).toBeVisible({
      timeout: 20_000,
    });

    const out = await postDemoSegment(request, {
      text: "Our project ETA is six weeks from kickoff after procurement.",
      speaker_role: "customer",
      offset_seconds: 132,
    });
    const timelineItem = out.checklist?.items?.find((item) => item.id === "timeline");
    const timelineEvidence = timelineItem?.evidence?.at(-1);
    expect(timelineEvidence?.value).toContain("project ETA is six weeks from kickoff");

    const bantLiveSection = page.getByTestId("bant-live-section");
    await expect(bantLiveSection).toContainText(/Timeline/i, { timeout: 25_000 });
    await expect(bantLiveSection).toContainText(/project ETA is six weeks from kickoff/i, {
      timeout: 25_000,
    });
  });

  test("fragmented live speech updates BANT and clears idle transcript cursor", async ({
    page,
    request,
  }) => {
    const callId = `fragmented-live-bant-${RUN_ID}`;
    const accountName = `Fragmented Live BANT ${RUN_ID}`;
    await seedE2eCall(request, callId, accountName);

    await page.goto(`/calls/${callId}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/calls/${callId}"]`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    await postDemoSegment(
      request,
      {
        text: "I have budget around",
        speaker_role: "customer",
        offset_seconds: 47,
      },
      callId
    );
    await postDemoSegment(
      request,
      {
        text: "400k",
        speaker_role: "customer",
        offset_seconds: 51,
      },
      callId
    );
    const out = await postDemoSegment(
      request,
      {
        text: "The deadline for our project timeline will be not more than three months.",
        speaker_role: "customer",
        offset_seconds: 56,
      },
      callId
    );

    const budgetItem = out.checklist?.items?.find((item) => item.id === "budget");
    const timelineItem = out.checklist?.items?.find((item) => item.id === "timeline");
    expect(budgetItem?.evidence?.at(-1)?.value?.toLowerCase()).toContain("400k");
    expect(out.checklist?.bant?.timeline).toBe("confirmed");
    expect(timelineItem?.evidence?.at(-1)?.value).toContain(
      "project timeline will be not more than three months"
    );

    await expect(page.getByText("400k").first()).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText(/not more than three months/i).first()).toBeVisible({
      timeout: 25_000,
    });

    await expect
      .poll(async () => (await page.locator("body").innerText()).replace(/\s+/g, " "))
      .toMatch(/Budget Confirmed|Budget Partially qualified|Partially covered: [^.]*Budget/i);
    const bodyText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    expect(bodyText).not.toMatch(/Still to cover: [^.]*Budget/i);
    expect(bodyText).not.toMatch(/Still to cover: [^.]*Timeline/i);

    await expect(page.locator(".animate-cursor")).toHaveCount(0, { timeout: 6_000 });
  });

  test("End & review reflects misattributed Recall BANT transcript on Post-DC page", async ({
    page,
    request,
  }) => {
    const callId = `misattributed-recall-post-dc-${RUN_ID}`;
    const accountName = `Misattributed Recall Post DC ${RUN_ID}`;
    await seedE2eCall(request, callId, accountName);

    await page.goto(`/calls/${callId}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/calls/${callId}"]`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    await postDemoSegment(
      request,
      {
        text: "i have budget around",
        speaker_role: "ae",
        offset_seconds: 54,
      },
      callId
    );
    await postDemoSegment(
      request,
      {
        text: "400k",
        speaker_role: "ae",
        offset_seconds: 59,
      },
      callId
    );
    await postDemoSegment(
      request,
      {
        text: "and the deadline for our project timeline will be not more than three months",
        speaker_role: "ae",
        offset_seconds: 62,
      },
      callId
    );

    const wrapUpResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/calls/${callId}/post-call`) &&
        res.request().method() === "POST"
    );
    await page.getByRole("button", { name: /End & review/i }).click();
    const res = await wrapUpResponse;
    expect(res.ok(), `wrap-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = (await res.json()) as {
      review?: {
        summary?: string[];
        learned?: Array<{ label?: string; note?: string }>;
        openDiscoveryGaps?: string[];
        discoveryBantCoverage?: number;
      };
      coaching?: {
        bantProgression?: {
          after?: Record<"budget" | "authority" | "need" | "timeline", string>;
        };
      };
      task?: {
        clientEmailDraft?: { body_markdown?: string };
        internalEmailDraft?: { body_markdown?: string };
      };
    };

    const after = body.coaching?.bantProgression?.after ?? {
      budget: "",
      authority: "",
      need: "",
      timeline: "",
    };
    const reviewText = [
      ...(body.review?.summary ?? []),
      ...((body.review?.learned ?? []).map((item) => `${item.label ?? ""} ${item.note ?? ""}`)),
    ].join(" ");
    expect(after.budget).toMatch(/partial|confirmed/i);
    expect(after.timeline).toBe("confirmed");
    expect(body.review?.discoveryBantCoverage ?? 0).toBeGreaterThan(0);
    expect(body.review?.openDiscoveryGaps ?? []).not.toContain("timeline");
    expect(reviewText).toMatch(/400k/i);
    expect(reviewText).toMatch(/not more than three months/i);
    expect(reviewText).not.toMatch(/BANT coverage finished at 0%/i);
    expect(body.task?.internalEmailDraft?.body_markdown ?? "").toMatch(/400k/i);
    expect(body.task?.clientEmailDraft?.body_markdown ?? "").toMatch(/not more than three months/i);

    await expect(page).toHaveURL(new RegExp(`/calls/${callId}/post-dc\\?wrapped=1`), {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: /Post-DC review/i })).toBeVisible({
      timeout: 30_000,
    });

    const overviewPanel = page.locator('[role="tabpanel"]:visible');
    await expect(overviewPanel).toContainText(/400k/i);
    await expect(overviewPanel).toContainText(/not more than three months/i);
    await expect(overviewPanel).not.toContainText(/BANT coverage finished at 0%/i);
    await expect(overviewPanel).not.toContainText(/Timeline moved from unknown to unknown/i);

    await page.getByRole("tab", { name: /Follow up/i }).click();
    const followUpPanel = page.locator('[role="tabpanel"]:visible');
    await expect(followUpPanel).toContainText(/not more than three months/i);
    await expect(followUpPanel).toContainText(/400k/i);
  });

  test("API sentiment payloads switch the rail between red and green", async ({
    page,
    request,
  }) => {
    await page.goto(`/calls/${CALL_ID}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    const sentimentSection = page.getByTestId("sentiment-section");
    const sentimentSignalsSection = page.getByTestId("sentiment-signals-section");
    const customerTile = sentimentSection.locator('[data-sentiment-label="customer"]');
    const repToneTile = sentimentSection.locator('[data-sentiment-label="sales-rep"]');
    const decisionCue = page.getByTestId("sentiment-decision-cue");
    const currentBar = sentimentSection.locator('[data-current-sentiment="true"]').last();

    await expect(customerTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect(repToneTile).toContainText(/Sales rep tone/i);
    await expect(repToneTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect(decisionCue).toContainText(/Recommended move/i);

    await postDemoSegment(request, {
      text: "Manual audits are a nightmare and a bottleneck, and we are concerned about delays.",
      speaker_role: "customer",
      offset_seconds: 210,
    });

    await expect
      .poll(async () => customerTile.getAttribute("data-sentiment-tone"), { timeout: 25_000 })
      .toBe("negative");
    await expect
      .poll(async () => currentBar.getAttribute("data-sentiment-tone"), { timeout: 25_000 })
      .toBe("negative");
    await expect(customerTile).toContainText(/Pain exposed|Decision risk/i);
    await expect(customerTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect
      .poll(async () => decisionCue.getAttribute("data-sentiment-decision"), { timeout: 25_000 })
      .toBe("recover");
    await expect(decisionCue).toContainText(/Recover trust/i);
    await expect(sentimentSignalsSection).toContainText(/Customer sentiment:\s*(Pain exposed|Decision risk)/i, {
      timeout: 25_000,
    });
    await expect(sentimentSignalsSection).toContainText(/nightmare and a bottleneck/i);

    await postDemoSegment(request, {
      text: "That's a great first answer and exactly what we needed. We are excited to move forward.",
      speaker_role: "customer",
      offset_seconds: 220,
    });

    await expect
      .poll(async () => customerTile.getAttribute("data-sentiment-tone"), { timeout: 25_000 })
      .toBe("positive");
    await expect
      .poll(async () => currentBar.getAttribute("data-sentiment-tone"), { timeout: 25_000 })
      .toBe("positive");
    await expect(customerTile).toContainText(/Buying confidence|Engaged buyer/i);
    await expect(customerTile).not.toContainText(/[+-]\d+%\s+(concern|upbeat)/i);
    await expect(sentimentSignalsSection).toContainText(/Customer sentiment:\s*(Buying confidence|Engaged buyer)/i);
  });

  test("End & review saves live call summary for Post-DC analysis", async ({
    page,
    request,
  }) => {
    await page.goto(`/calls/${CALL_ID}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(`a[href="/calls/${CALL_ID}"]`).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    await postDemoSegment(request, {
      text: "Budget is approved, the CFO owns the decision, and we need the Q3 pilot deadline captured for review.",
      speaker_role: "customer",
      offset_seconds: 240,
    });
    await postDemoSegment(request, {
      text: "Please send the security architecture overview and CFO ROI one-pager, then schedule the Q3 pilot review with our CFO next week.",
      speaker_role: "customer",
      offset_seconds: 248,
    });

    const wrapUpResponse = page.waitForResponse(
      (res) =>
        res.url().includes(`/api/calls/${CALL_ID}/post-call`) &&
        res.request().method() === "POST"
    );
    await page.getByRole("button", { name: /End & review/i }).click();
    const res = await wrapUpResponse;
    expect(res.ok(), `wrap-up failed: ${res.status()} ${await res.text()}`).toBeTruthy();

    const body = (await res.json()) as {
      agentInputs?: {
        hasCallAgentHandoff?: boolean;
        transcriptEventCount?: number;
      };
      call_agent_outputs?: {
        operation?: string;
        transcript?: { event_count?: number; full_text?: string };
        transcript_summary?: { headline?: string; bullets?: string[] };
        summary?: { transcript_segments?: number };
        bant?: { status?: Record<string, string> };
      };
      review?: {
        summary?: string[];
        learned?: Array<{ label?: string; note?: string }>;
        openDiscoveryGaps?: string[];
        discoveryBantCoverage?: number;
      };
      task?: {
        emailDraft?: {
          status?: string;
          subject?: string;
          body_markdown?: string;
          commitments_referenced?: string[];
        };
        clientEmailDraft?: {
          status?: string;
          subject?: string;
          body_markdown?: string;
          commitments_referenced?: string[];
        };
        internalEmailDraft?: {
          status?: string;
          body_markdown?: string;
          commitments_referenced?: string[];
        };
        taskList?: Array<{
          task_type?: string;
          owner?: string;
          description?: string;
          status?: string;
        }>;
      };
      emailAttachments?: {
        missing?: Array<{ name?: string; requiredData?: string }>;
      };
      jiraTicket?: {
        summary?: string;
        labels?: string[];
        bantSnapshot?: Record<"budget" | "authority" | "need" | "timeline", boolean>;
      } | null;
    };
    const handoff = body.call_agent_outputs;
    const taskList = body.task?.taskList ?? [];
    const taskText = taskList.map((task) => task.description ?? "").join(" ");
    const clientDraft = body.task?.clientEmailDraft ?? body.task?.emailDraft;
    const clientEmailText = [
      clientDraft?.subject ?? "",
      clientDraft?.body_markdown ?? "",
      ...(clientDraft?.commitments_referenced ?? []),
    ].join(" ");
    const internalDraft = body.task?.internalEmailDraft;
    const internalEmailText = [
      internalDraft?.body_markdown ?? "",
      ...(internalDraft?.commitments_referenced ?? []),
    ].join(" ");
    const reviewText = [
      ...(body.review?.summary ?? []),
      ...((body.review?.learned ?? []).map((item) => `${item.label ?? ""} ${item.note ?? ""}`)),
    ].join(" ");
    const missingContentText = (body.emailAttachments?.missing ?? [])
      .map((item) => `${item.name ?? ""} ${item.requiredData ?? ""}`)
      .join(" ");

    expect(body.agentInputs?.hasCallAgentHandoff).toBe(true);
    expect(body.agentInputs?.transcriptEventCount ?? 0).toBeGreaterThan(0);
    expect(handoff?.operation).toBe("call_end_handoff");
    expect(handoff?.transcript?.event_count ?? 0).toBeGreaterThan(0);
    expect(handoff?.transcript?.full_text ?? "").toMatch(
      /budget is approved|q3 pilot deadline|security architecture|cfo roi one-pager/i
    );
    expect(handoff?.transcript_summary?.headline ?? "").toMatch(/transcript segments captured/i);
    expect(handoff?.summary?.transcript_segments ?? 0).toBeGreaterThan(0);
    expect(handoff?.bant?.status?.budget).toMatch(/partial|confirmed/i);
    expect(handoff?.bant?.status?.authority).toMatch(/partial|confirmed/i);
    expect(handoff?.bant?.status?.timeline).toMatch(/partial|confirmed/i);
    expect((body.review?.summary ?? []).join(" ")).toMatch(
      /Dominant live-call intent|Focus areas|Transcript needs|Open discovery gaps/i
    );
    expect(reviewText).toMatch(/BANT|Budget|Authority|Need|Timeline|Q3 pilot|CFO/i);
    expect(typeof body.review?.discoveryBantCoverage).toBe("number");

    expect(clientDraft?.status).toBe("draft_pending_approval");
    expect(clientEmailText).toMatch(/Minutes of meeting|What we committed to|security architecture|CFO ROI|Q3 pilot/i);
    expect(clientEmailText).not.toMatch(/\bBANT\b|Open discovery gaps|internal|Jira/i);

    expect(internalDraft?.status).toBe("draft_pending_approval");
    expect(internalEmailText).toMatch(/BANT score|BANT details|Budget|Authority|Need|Timeline/i);
    expect(internalEmailText).toMatch(/security architecture|CFO ROI|Q3 pilot|CFO/i);

    expect(taskList.length).toBeGreaterThan(0);
    expect(taskList.every((task) => task.status === "pending_approval")).toBe(true);
    expect(taskText).toMatch(/follow-up email draft|security architecture|CFO ROI|Q3 pilot|CFO/i);
    expect(missingContentText).toMatch(/security architecture|CFO ROI|Q3 pilot|CFO/i);

    await expect(page).toHaveURL(new RegExp(`/calls/${CALL_ID}/post-dc\\?wrapped=1`), {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { name: /Post-DC review/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole("tab", { name: /Follow up/i }).click();
    const followUpPanel = page.locator('[role="tabpanel"]:visible');
    await expect(followUpPanel).toHaveCount(1);
    const clientEmailCard = followUpPanel
      .locator(".glass-insight-card")
      .filter({ has: page.getByText("Follow-up Email", { exact: true }) });
    await expect(clientEmailCard).toHaveCount(1);
    await expect(clientEmailCard).toContainText(/Minutes of meeting/i);
    await expect(clientEmailCard).toContainText(/What we committed to/i);
    await expect(clientEmailCard).toContainText(/security architecture|CFO ROI|Q3 pilot/i);
    await expect(clientEmailCard).not.toContainText(/\bBANT\b|Open discovery gaps|internal|Jira/i);

    const internalEmailCard = followUpPanel
      .locator(".glass-insight-card")
      .filter({ has: page.getByText("Internal team email", { exact: true }) });
    await expect(internalEmailCard).toHaveCount(1);
    await expect(internalEmailCard).toContainText(/BANT score|BANT details/i);
    await expect(internalEmailCard).toContainText(/Budget|Authority|Need|Timeline/i);
    await expect(internalEmailCard).toContainText(/Next action items/i);
    await expect(internalEmailCard).toContainText(/security architecture|CFO ROI|Q3 pilot|CFO/i);

    await page.getByRole("tab", { name: /Actions/i }).click();
    const actionsPanel = page.locator('[role="tabpanel"]:visible');
    await expect(actionsPanel).toHaveCount(1);
    await expect(actionsPanel).toContainText(/Task list/i);
    await expect(actionsPanel).toContainText(/Pending/i);
    await expect(actionsPanel).toContainText(/Follow-up|Content request|Schedule next meeting|Internal review/i);
    await expect(actionsPanel).toContainText(/security architecture|CFO ROI|Q3 pilot|CFO/i);

    const isBantQualified =
      body.jiraTicket?.bantSnapshot &&
      Object.values(body.jiraTicket.bantSnapshot).every((isConfirmed) => isConfirmed);
    await page.getByRole("tab", { name: /Jira ticket/i }).click();
    const jiraPanel = page.locator('[role="tabpanel"]:visible');
    await expect(jiraPanel).toHaveCount(1);
    await expect(jiraPanel).toContainText(/Jira ticket draft/i);
    await expect(jiraPanel).toContainText(isBantQualified ? /BANT qualified/i : /BANT review needed/i);
    await expect(jiraPanel).toContainText(/Budget/i);
    await expect(jiraPanel).toContainText(/Authority/i);
    await expect(jiraPanel).toContainText(/Need/i);
    await expect(jiraPanel).toContainText(/Timeline/i);
  });
});
