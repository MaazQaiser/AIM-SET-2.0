import { describe, expect, it } from "vitest";
import {
  buildPostDcWorkflowTasks,
  countWorkflowTasksDone,
  countWorkflowTasksTotal,
  getPostDcRecommendation,
} from "@/lib/post-dc/workflow-tasks";
import type { PostCallReview } from "@/lib/brief-types";

const baseReview: PostCallReview = {
  headline: "Opportunity · High Potential",
  summary: ["Strong discovery call."],
  podScorecard: [],
  learned: [],
};

describe("getPostDcRecommendation", () => {
  it("returns trimmed next step proposal", () => {
    expect(
      getPostDcRecommendation({
        ...baseReview,
        nextStepProposal: "  Schedule CFO readout.  ",
      })
    ).toBe("Schedule CFO readout.");
  });
});

describe("buildPostDcWorkflowTasks", () => {
  it("always includes client email for not-a-fit deals", () => {
    const tasks = buildPostDcWorkflowTasks({
      review: baseReview,
      leadStage: "Not a fit",
      hasEmailDraft: false,
      hasJiraTicket: false,
    });
    expect(tasks.some((t) => t.kind === "send_client_email")).toBe(true);
    expect(tasks.some((t) => t.kind === "create_jira_ticket")).toBe(false);
    expect(tasks.some((t) => t.kind === "build_proposal")).toBe(false);
  });

  it("does not duplicate AI recommendation in task descriptions", () => {
    const proposal =
      "Lead with healthcare ERP case studies and HIPAA/compliance posture.";
    const tasks = buildPostDcWorkflowTasks({
      review: { ...baseReview, nextStepProposal: proposal },
      leadStage: "Opportunity",
      hasEmailDraft: true,
      hasJiraTicket: true,
    });
    expect(tasks.every((t) => t.title !== proposal)).toBe(true);
  });

  it("includes jira, meeting, landing, and proposal for opportunity deals", () => {
    const tasks = buildPostDcWorkflowTasks({
      review: {
        ...baseReview,
        nextStepProposal: "Schedule CFO readout with solution architect.",
      },
      leadStage: "Opportunity",
      hasEmailDraft: true,
      hasJiraTicket: true,
      landingPage: { status: "draft", callId: "c1" } as never,
    });
    const kinds = tasks.map((t) => t.kind);
    expect(kinds).toContain("send_client_email");
    expect(kinds).toContain("create_jira_ticket");
    expect(kinds).toContain("schedule_meeting");
    expect(kinds).toContain("create_landing_page");
    expect(kinds).toContain("build_proposal");
  });

  it("hides proposal for nurture deals", () => {
    const tasks = buildPostDcWorkflowTasks({
      review: baseReview,
      leadStage: "Nurture",
      hasEmailDraft: true,
      hasJiraTicket: false,
    });
    expect(tasks.some((t) => t.kind === "build_proposal")).toBe(false);
    expect(tasks.some((t) => t.kind === "schedule_meeting")).toBe(true);
  });

  it("marks build proposal as coming soon", () => {
    const tasks = buildPostDcWorkflowTasks({
      review: baseReview,
      leadStage: "Opportunity",
      hasEmailDraft: false,
      hasJiraTicket: false,
      statusOverrides: {
        "wf-build-proposal": "done",
      },
    });
    const proposal = tasks.find((t) => t.kind === "build_proposal");
    expect(proposal?.badge).toBe("Coming soon");
    expect(proposal?.actionDisabled).toBe(true);
    expect(proposal?.countsTowardProgress).toBe(false);
    expect(proposal?.status).toBe("pending");
    expect(countWorkflowTasksTotal(tasks)).toBe(tasks.length - 1);
    expect(countWorkflowTasksDone(tasks)).toBe(0);
  });
});
