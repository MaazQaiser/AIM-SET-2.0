import { test, expect } from "@playwright/test";

test.setTimeout(120_000);

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const CALL_ID = `frontera-franchise-group-e2e-${RUN_ID}`;
const API_BASE = process.env.PLAYWRIGHT_API_URL ?? "http://localhost:8000";
const TENANT = "e2e-tenant";
const USER = "e2e-user";

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
  segment: { text: string; speaker_role: string; offset_seconds: number }
) {
  const url = `${API_BASE}/api/v1/webhooks/recall/demo-segment?call_id=${CALL_ID}&tenant_id=${TENANT}&user_id=${USER}`;
  const res = await request.post(url, {
    data: {
      text: segment.text,
      speaker_role: segment.speaker_role,
      offset_seconds: segment.offset_seconds,
      provider_event_id: `e2e-${segment.offset_seconds}-${Date.now()}`,
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

test.describe.configure({ mode: "serial" });

test.describe("Live call cockpit — DOM + API", () => {
  test.beforeAll(async ({ request }) => {
    const health = await request.get(`${API_BASE}/health`);
    expect(health.ok(), "API must be running on :8000 with DEMO_TRANSCRIPT_REPLAY=true").toBeTruthy();
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
    await expect(
      page.getByText(/Customer raised:|align next questions to this pain/i).first()
    ).toBeVisible({
      timeout: 45_000,
    });

    const sentimentSection = page.locator("section", { hasText: "Sentiment" }).first();
    await expect(sentimentSection).toContainText("Customer");
    await expect
      .poll(async () => sentimentSection.innerText(), { timeout: 45_000 })
      .toMatch(/Customer\s+-\d+%\s+concern/i);

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
    expect(["partial", "confirmed"]).toContainEqual(bant.timeline);
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

    const bantLiveSection = page.locator("section", { hasText: "BANT live" }).first();
    await expect(bantLiveSection).toContainText(/Timeline/i, { timeout: 25_000 });
    await expect(bantLiveSection).toContainText(/project ETA is six weeks from kickoff/i, {
      timeout: 25_000,
    });
  });

  test("API sentiment payloads switch the rail between red and green", async ({
    page,
    request,
  }) => {
    await page.goto(`/calls/${CALL_ID}/live`, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Connecting stream…")).toBeHidden({ timeout: 25_000 });

    const sentimentSection = page.locator("section", { hasText: "Sentiment" }).first();
    const customerTile = sentimentSection.locator('[data-sentiment-label="customer"]');
    const currentBar = sentimentSection.locator('[data-current-sentiment="true"]').last();

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
    await expect(sentimentSection).toContainText(/Customer\s*-\d+%\s+concern/i);

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
    await expect(sentimentSection).toContainText(/Customer\s*\+\d+%\s+upbeat/i);
  });
});
