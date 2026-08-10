import { addHours, differenceInMinutes, isWithinInterval, subMinutes } from "date-fns";
import type { AiTodo, AiTodoKind, AiTodoPriority } from "@/hooks/use-ai-todos";
import type { Call } from "@/types";
import { companyRatingForCall, icpScoreFromBucket } from "@/lib/dc-notes/icp-rating";
import { callDetailsHref } from "./call-links";
import {
  callOpportunityValue,
  callScheduleDate,
  isOpenCall,
} from "./call-metrics";

export const CALL_FOCUS_WINDOW_HOURS = 24;
export const CALL_FOCUS_RECENT_START_GRACE_MINUTES = 30;
export const CALL_FOCUS_VISIBLE_ACTION_LIMIT = 3;
export const CALL_FOCUS_CLOSE_ICP_RATING_THRESHOLD = 7;

export interface CallFocusAction {
  todo: AiTodo;
  done: boolean;
}

export interface CallFocusItem {
  call: Call;
  scheduledAt: Date;
  score: number;
  priority: "high" | "medium" | "low";
  reasons: string[];
  actions: CallFocusAction[];
  visibleActions: CallFocusAction[];
  hiddenActionCount: number;
  openActionCount: number;
  primaryHref: string;
  primaryCta: "Join live" | "Open prep" | "Review brief";
}

export interface CallFocusModel {
  calls: CallFocusItem[];
  criticalActions: CallFocusAction[];
  criticalActionCount: number;
  criticalOverflowCount: number;
  totalPrepActionCount: number;
  highPriorityCallCount: number;
  windowHours: number;
}

interface BuildCallFocusModelOptions {
  calls: Call[];
  todos: AiTodo[];
  doneIds?: Set<string>;
  now?: Date;
  windowHours?: number;
}

const CALL_ACTION_KINDS = new Set<AiTodoKind>([
  "call_prep",
  "content_asset",
  "deck",
  "brief",
  "coaching",
]);

const PRIORITY_RANK: Record<AiTodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const KIND_RANK: Record<AiTodoKind, number> = {
  call_prep: 0,
  content_asset: 1,
  deck: 2,
  brief: 3,
  coaching: 4,
  post_dc: 5,
  lead_hub: 6,
};

function isCallInsideFocusWindow(call: Call, now: Date, end: Date): boolean {
  if (!isOpenCall(call)) return false;
  if (call.status === "live") return true;

  const at = callScheduleDate(call);
  if (!Number.isFinite(at.getTime())) return false;

  return isWithinInterval(at, {
    start: subMinutes(now, CALL_FOCUS_RECENT_START_GRACE_MINUTES),
    end,
  });
}

function hasOpenBant(call: Call): boolean {
  const bant = call.bant;
  if (!bant) return true;
  return [bant.budget, bant.authority, bant.need, bant.timeline].some(
    (status) => status !== "confirmed"
  );
}

function sortTodos(a: AiTodo, b: AiTodo): number {
  if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  if (KIND_RANK[a.kind] !== KIND_RANK[b.kind]) {
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  }
  return a.title.localeCompare(b.title);
}

function countActions(actions: CallFocusAction[], priority: AiTodoPriority): number {
  return actions.filter((action) => action.todo.priority === priority).length;
}

function countAssetActions(actions: CallFocusAction[]): number {
  return actions.filter((action) =>
    action.todo.kind === "content_asset" || action.todo.kind === "deck"
  ).length;
}

function callIcpFitScore(call: Call): number {
  if (typeof call.icpMatch === "number" && Number.isFinite(call.icpMatch)) {
    return call.icpMatch;
  }

  return icpScoreFromBucket(call.icpBucket ?? "");
}

function hasCloseIcpMatch(call: Call): boolean {
  return companyRatingForCall(call) >= CALL_FOCUS_CLOSE_ICP_RATING_THRESHOLD;
}

function scoreCall(call: Call, scheduledAt: Date, actions: CallFocusAction[], now: Date): number {
  const minutesUntil = differenceInMinutes(scheduledAt, now);
  const highActions = countActions(actions, "high");
  const mediumActions = countActions(actions, "medium");
  const lowActions = countActions(actions, "low");
  const assetActions = countAssetActions(actions);
  const opportunity = callOpportunityValue(call);
  const openBant = hasOpenBant(call);
  const icpFit = callIcpFitScore(call);
  const closeIcpMatch = hasCloseIcpMatch(call);

  let score = 0;

  if (call.status === "live") score += 1000;
  else if (minutesUntil <= 0) score += 520;
  else if (minutesUntil <= 120) score += 460;
  else if (minutesUntil <= 360) score += 260;
  else if (minutesUntil <= 1440) score += 140;
  else score += 60;

  score += highActions * 180;
  score += mediumActions * 80;
  score += lowActions * 25;
  score += assetActions * 45;
  if (!call.briefReady) score += 90;
  if (openBant) score += 70;
  score += closeIcpMatch ? 160 : Math.round(icpFit * 40);
  score += Math.min(opportunity / 1_000_000, 250);

  return Math.round(score);
}

function callPriority(call: Call, scheduledAt: Date, actions: CallFocusAction[], score: number, now: Date) {
  const minutesUntil = differenceInMinutes(scheduledAt, now);
  const hasHighAction = actions.some((action) => action.todo.priority === "high");
  const closeIcpMatch = hasCloseIcpMatch(call);

  if (
    call.status === "live" ||
    hasHighAction ||
    (closeIcpMatch && minutesUntil <= 1440) ||
    score >= 520
  ) {
    return "high";
  }

  if (actions.length > 0 || !call.briefReady || hasOpenBant(call) || minutesUntil <= 1440) {
    return "medium";
  }

  return "low";
}

function buildReasons(call: Call, actions: CallFocusAction[]): string[] {
  const reasons: string[] = [];
  const highActions = countActions(actions, "high");

  if (highActions > 0) {
    reasons.push(`${highActions} high-priority prep action${highActions === 1 ? "" : "s"}`);
  }

  if (!call.briefReady) {
    reasons.push("Brief still needs review");
  }

  return reasons.slice(0, 3);
}

function primaryCta(call: Call, actions: CallFocusAction[]): CallFocusItem["primaryCta"] {
  if (call.status === "live") return "Join live";
  if (actions.length > 0) return "Open prep";
  return "Review brief";
}

export function buildCallFocusModel({
  calls,
  todos,
  doneIds = new Set(),
  now = new Date(),
  windowHours = CALL_FOCUS_WINDOW_HOURS,
}: BuildCallFocusModelOptions): CallFocusModel {
  const windowEnd = addHours(now, windowHours);
  const focusCalls = calls.filter((call) => isCallInsideFocusWindow(call, now, windowEnd));
  const focusCallIds = new Set(focusCalls.map((call) => call.id));
  const groupedTodos = new Map<string, AiTodo[]>();
  const criticalTodos: AiTodo[] = [];

  for (const todo of todos) {
    if (doneIds.has(todo.id)) continue;

    if (
      todo.callId &&
      focusCallIds.has(todo.callId) &&
      CALL_ACTION_KINDS.has(todo.kind)
    ) {
      const existing = groupedTodos.get(todo.callId) ?? [];
      existing.push(todo);
      groupedTodos.set(todo.callId, existing);
      continue;
    }

    if (todo.priority === "high") {
      criticalTodos.push(todo);
    }
  }

  const focusItems = focusCalls
    .map((call): CallFocusItem => {
      const scheduledAt = callScheduleDate(call);
      const actions = (groupedTodos.get(call.id) ?? [])
        .sort(sortTodos)
        .map((todo) => ({ todo, done: false }));
      const score = scoreCall(call, scheduledAt, actions, now);
      const priority = callPriority(call, scheduledAt, actions, score, now);

      return {
        call,
        scheduledAt,
        score,
        priority,
        reasons: buildReasons(call, actions),
        actions,
        visibleActions: actions.slice(0, CALL_FOCUS_VISIBLE_ACTION_LIMIT),
        hiddenActionCount: Math.max(0, actions.length - CALL_FOCUS_VISIBLE_ACTION_LIMIT),
        openActionCount: actions.length,
        primaryHref: callDetailsHref(call),
        primaryCta: primaryCta(call, actions),
      };
    })
    .sort((a, b) => {
      const scheduledDelta = a.scheduledAt.getTime() - b.scheduledAt.getTime();
      if (scheduledDelta !== 0) return scheduledDelta;
      return b.score - a.score;
    });

  const sortedCritical = criticalTodos.sort(sortTodos);
  const criticalActions = sortedCritical.map((todo) => ({ todo, done: false }));

  return {
    calls: focusItems,
    criticalActions,
    criticalActionCount: sortedCritical.length,
    criticalOverflowCount: 0,
    totalPrepActionCount: focusItems.reduce((sum, item) => sum + item.openActionCount, 0),
    highPriorityCallCount: focusItems.filter((item) => item.priority === "high").length,
    windowHours,
  };
}
