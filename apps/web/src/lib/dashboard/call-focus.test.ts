import { describe, expect, it } from "vitest";
import {
  CALL_FOCUS_VISIBLE_ACTION_LIMIT,
  buildCallFocusModel,
} from "./call-focus";
import type { AiTodo } from "@/hooks/use-ai-todos";
import { companyRatingForCall } from "@/lib/dc-notes/icp-rating";
import type { Call } from "@/types";

const NOW = new Date("2026-06-09T10:00:00.000Z");

function call(overrides: Partial<Call>): Call {
  return {
    id: "call-acme",
    accountName: "Acme",
    scheduledAt: "2026-06-09T12:00:00.000Z",
    status: "upcoming",
    pod: [],
    briefReady: true,
    bant: {
      budget: "confirmed",
      authority: "confirmed",
      need: "confirmed",
      timeline: "confirmed",
    },
    ...overrides,
  };
}

function todo(overrides: Partial<AiTodo> & Pick<AiTodo, "id" | "title">): AiTodo {
  return {
    agent: "live-call",
    href: "/calls/call-acme",
    kind: "call_prep",
    priority: "medium",
    ...overrides,
  };
}

describe("buildCallFocusModel", () => {
  it("filters open calls to the next 24 hours", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [
        call({ id: "soon", scheduledAt: "2026-06-09T11:00:00.000Z" }),
        call({ id: "within-24", scheduledAt: "2026-06-10T09:00:00.000Z" }),
        call({ id: "after-24", scheduledAt: "2026-06-10T11:01:00.000Z" }),
        call({ id: "past", scheduledAt: "2026-06-09T09:00:00.000Z" }),
        call({
          id: "completed",
          status: "completed",
          scheduledAt: "2026-06-09T11:00:00.000Z",
        }),
      ],
      todos: [],
    });

    expect(model.calls.map((item) => item.call.id)).toEqual(["soon", "within-24"]);
  });

  it("can expand the focus window to 48 hours", () => {
    const model = buildCallFocusModel({
      now: NOW,
      windowHours: 48,
      calls: [
        call({ id: "within-24", scheduledAt: "2026-06-09T12:00:00.000Z" }),
        call({ id: "within-48", scheduledAt: "2026-06-11T08:00:00.000Z" }),
        call({ id: "after-48", scheduledAt: "2026-06-11T11:01:00.000Z" }),
      ],
      todos: [],
    });

    expect(model.windowHours).toBe(48);
    expect(model.calls.map((item) => item.call.id)).toEqual(["within-24", "within-48"]);
  });

  it("orders live and soon calls above later calls without making every soon call high priority", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [
        call({ id: "tomorrow", scheduledAt: "2026-06-10T10:00:00.000Z" }),
        call({ id: "soon", scheduledAt: "2026-06-09T10:45:00.000Z" }),
        call({ id: "live", status: "live", scheduledAt: "2026-06-09T09:30:00.000Z" }),
      ],
      todos: [],
    });

    expect(model.calls.map((item) => item.call.id)).toEqual(["live", "soon", "tomorrow"]);
    expect(model.calls.find((item) => item.call.id === "soon")?.priority).toBe("medium");
    expect(model.highPriorityCallCount).toBe(1);
  });

  it("sorts focus calls by scheduled start time before focus score", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [
        call({
          id: "later-blocked",
          accountName: "Later Blocked",
          scheduledAt: "2026-06-09T18:00:00.000Z",
          annualRevenueRaw: "250000000",
          briefReady: false,
          bant: {
            budget: "unknown",
            authority: "partial",
            need: "confirmed",
            timeline: "unknown",
          },
        }),
        call({
          id: "earlier-ready",
          accountName: "Earlier Ready",
          scheduledAt: "2026-06-09T15:00:00.000Z",
        }),
      ],
      todos: [
        todo({
          id: "later-asset",
          title: "Generate case study",
          callId: "later-blocked",
          kind: "content_asset",
          priority: "high",
        }),
      ],
    });

    expect(model.calls[0]?.call.id).toBe("earlier-ready");
    expect(model.calls[1]?.call.id).toBe("later-blocked");
    expect(model.calls[1]?.score).toBeGreaterThan(model.calls[0]?.score ?? 0);
  });

  it("uses prep blockers, BANT gaps, brief readiness, and opportunity in scoring", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [
        call({
          id: "strategic",
          accountName: "Strategic",
          scheduledAt: "2026-06-09T18:00:00.000Z",
          annualRevenueRaw: "250000000",
          briefReady: false,
          bant: {
            budget: "unknown",
            authority: "partial",
            need: "confirmed",
            timeline: "unknown",
          },
        }),
        call({
          id: "ordinary",
          accountName: "Ordinary",
          scheduledAt: "2026-06-09T18:00:00.000Z",
          annualRevenueRaw: "1000000",
        }),
      ],
      todos: [
        todo({
          id: "asset",
          title: "Generate case study",
          callId: "strategic",
          kind: "content_asset",
          priority: "high",
        }),
      ],
    });

    expect(model.calls[0]?.call.id).toBe("strategic");
    expect(model.calls[0]?.score).toBeGreaterThan(model.calls[1]?.score ?? 0);
    expect(model.calls[0]?.reasons.join(" ")).toContain("high-priority");
    expect(model.calls[0]?.reasons.join(" ")).not.toContain("BANT");
    expect(model.calls[0]?.reasons.join(" ")).not.toContain("opportunity");
  });

  it("uses close ICP match as a priority and scoring signal without listing it as a reason", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [
        call({
          id: "close-icp",
          accountName: "Close ICP",
          scheduledAt: "2026-06-09T18:00:00.000Z",
          icpMatch: 0.9,
        }),
        call({
          id: "weak-icp",
          accountName: "Weak ICP",
          scheduledAt: "2026-06-09T18:00:00.000Z",
          icpMatch: 0.4,
        }),
      ],
      todos: [],
    });

    expect(model.calls[0]?.call.id).toBe("close-icp");
    expect(model.calls[0]?.priority).toBe("high");
    expect(model.calls[0]?.score).toBeGreaterThan(model.calls[1]?.score ?? 0);
    expect(model.calls[0]?.reasons).not.toContain("Close ICP match");
  });

  it("uses the displayed 7+ agent rating threshold for close ICP reasoning", () => {
    const sevenRatingCall = call({
      id: "potential-0",
      accountName: "Seven Rating",
      icpBucket: "Potential",
      icpMatch: undefined,
      scheduledAt: "2026-06-09T18:00:00.000Z",
    });
    const sixRatingCall = call({
      id: "sweet-1",
      accountName: "Six Rating",
      icpBucket: "Sweet spot",
      icpMatch: undefined,
      scheduledAt: "2026-06-09T19:00:00.000Z",
    });

    expect(companyRatingForCall(sevenRatingCall)).toBe(7);
    expect(companyRatingForCall(sixRatingCall)).toBe(6);

    const model = buildCallFocusModel({
      now: NOW,
      calls: [sevenRatingCall, sixRatingCall],
      todos: [],
    });

    expect(model.calls.find((item) => item.call.id === "potential-0")?.priority).toBe("high");
    expect(model.calls.find((item) => item.call.id === "potential-0")?.reasons).not.toContain(
      "Close ICP match"
    );
    expect(model.calls.find((item) => item.call.id === "sweet-1")?.priority).toBe("medium");
    expect(model.calls.find((item) => item.call.id === "sweet-1")?.reasons).not.toContain(
      "Close ICP match"
    );
  });

  it("groups call actions and caps visible prep actions", () => {
    const todos = Array.from({ length: 5 }, (_, index) =>
      todo({
        id: `todo-${index}`,
        title: `Prep action ${index}`,
        callId: "call-acme",
        priority: index === 0 ? "high" : "medium",
      })
    );

    const model = buildCallFocusModel({
      now: NOW,
      calls: [call({ id: "call-acme" })],
      todos,
    });

    expect(model.totalPrepActionCount).toBe(5);
    expect(model.calls[0]?.openActionCount).toBe(5);
    expect(model.calls[0]?.visibleActions).toHaveLength(CALL_FOCUS_VISIBLE_ACTION_LIMIT);
    expect(model.calls[0]?.hiddenActionCount).toBe(2);
  });

  it("separates high-priority non-call todos into critical actions", () => {
    const model = buildCallFocusModel({
      now: NOW,
      calls: [call({ id: "call-acme" })],
      todos: [
        todo({
          id: "approval",
          title: "Approve follow-up",
          kind: "post_dc",
          priority: "high",
          href: "/calls/done/post-dc",
        }),
        todo({
          id: "call-prep",
          title: "Prep call",
          callId: "call-acme",
          priority: "high",
        }),
      ],
    });

    expect(model.criticalActionCount).toBe(1);
    expect(model.criticalActions[0]?.todo.id).toBe("approval");
    expect(model.calls[0]?.actions.map((action) => action.todo.id)).toEqual(["call-prep"]);
  });

  it("keeps all critical actions available for carousel navigation", () => {
    const criticalTodos = Array.from({ length: 5 }, (_, index) =>
      todo({
        id: `approval-${index}`,
        title: `Approve follow-up ${index}`,
        kind: "post_dc",
        priority: "high",
        href: `/calls/done/post-dc-${index}`,
      })
    );

    const model = buildCallFocusModel({
      now: NOW,
      calls: [call({ id: "call-acme" })],
      todos: criticalTodos,
    });

    expect(model.criticalActionCount).toBe(5);
    expect(model.criticalActions).toHaveLength(5);
    expect(model.criticalOverflowCount).toBe(0);
  });
});
