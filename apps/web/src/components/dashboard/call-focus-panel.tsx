"use client";

import { useEffect, useMemo, useState, type ElementType } from "react";
import Link from "next/link";
import { differenceInMinutes, format, isSameDay, isTomorrow } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Info,
  Mail,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@dc-copilot/ui/components/tooltip";
import { CallQuickDetailsDialog } from "@/components/calls/call-quick-details-dialog";
import { ParticipantAvatar } from "@/components/participant-avatar";
import {
  buildCallFocusModel,
  type CallFocusAction,
  type CallFocusItem,
} from "@/lib/dashboard/call-focus";
import {
  loadTodoDoneIds,
  saveTodoDoneIds,
} from "@/lib/dashboard/todo-completion-storage";
import { callOpportunityValue, formatOpportunityValue } from "@/lib/dashboard/call-metrics";
import { useCalls } from "@/lib/data/hooks";
import { companyRatingForCall, formatCompanyRating } from "@/lib/dc-notes/icp-rating";
import { useAiTodos, type AiTodoKind } from "@/hooks/use-ai-todos";
import { cn } from "@/lib/cn";
import type { Call } from "@/types";

const ACTION_KIND_CONFIG: Record<AiTodoKind, { icon: ElementType; label: string }> = {
  call_prep: { icon: Bot, label: "Prep" },
  content_asset: { icon: FileText, label: "Material" },
  deck: { icon: FileText, label: "Material" },
  brief: { icon: FileText, label: "Brief" },
  post_dc: { icon: Mail, label: "Post-DC" },
  coaching: { icon: TrendingUp, label: "Coaching" },
  lead_hub: { icon: Sparkles, label: "Lead hub" },
};

const FOCUS_WINDOW_OPTIONS = [24, 48] as const;
type FocusWindowHours = (typeof FOCUS_WINDOW_OPTIONS)[number];
const HIDDEN_CALL_REASON_LABELS = new Set(["Close ICP match"]);

function formatCallTime(item: CallFocusItem): string {
  const zone = formatTimeZone(item.scheduledAt);
  const zoneSuffix = zone ? ` ${zone}` : "";
  const clockTime = `${format(item.scheduledAt, "h:mm a")}${zoneSuffix}`;

  if (item.call.status === "live") return `Live now · ${clockTime}`;
  if (isSameDay(item.scheduledAt, new Date())) return clockTime;
  if (isTomorrow(item.scheduledAt)) return `Tomorrow ${clockTime}`;
  return `${format(item.scheduledAt, "EEE")} ${clockTime}`;
}

function formatTimeZone(date: Date): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (timeZone === "Asia/Karachi") return "PKT";

  return (
    new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
      .formatToParts(date)
      .find((part) => part.type === "timeZoneName")?.value ?? ""
  );
}

function compactDuration(minutes: number): string {
  const absolute = Math.abs(minutes);
  if (absolute < 60) return `${Math.max(1, absolute)}m`;

  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
}

function remainingCallTime(item: CallFocusItem): string {
  if (item.call.status === "live") return "In progress";

  const minutesUntil = differenceInMinutes(item.scheduledAt, new Date());
  if (minutesUntil < 0) return `Started ${compactDuration(minutesUntil)} ago`;
  if (minutesUntil === 0) return "Starting now";
  return `In ${compactDuration(minutesUntil)}`;
}

function leadName(item: CallFocusItem): string {
  return item.call.leadName?.trim() || "Buyer";
}

function statusChipText(item: CallFocusItem): string | null {
  if (item.call.status === "live") return "Live";
  if (item.priority === "high") return "Priority";
  return null;
}

function priorityTooltipReason(reason: string): string {
  if (reason.includes("high-priority prep action")) return `has ${reason}`;
  if (reason === "Brief still needs review") return "has a brief that still needs review";
  return reason.toLowerCase();
}

function priorityTooltipText(item: CallFocusItem, isPriority?: boolean): string {
  const reasons: string[] = [];
  const minutesUntil = differenceInMinutes(item.scheduledAt, new Date());

  if (item.call.status === "live") reasons.push("live now");
  else if (minutesUntil <= 120) reasons.push("starts soon");
  const displayReasons = displayCallReasons(item);
  if (displayReasons.length > 0) {
    reasons.push(...displayReasons.map(priorityTooltipReason));
  }
  if (isPriority && item.priority === "high") reasons.push("has the highest focus score in this window");

  const uniqueReasons = Array.from(new Set(reasons)).slice(0, 3);
  return uniqueReasons.length > 0
    ? `Priority because this call ${uniqueReasons.join(", ")}.`
    : "Priority because this call is the strongest focus item in this window.";
}

function agentRating(item: CallFocusItem): string {
  return formatCompanyRating(companyRatingForCall(item.call));
}

function opportunityLabel(item: CallFocusItem): string | null {
  const value = callOpportunityValue(item.call);
  if (value <= 0) return null;
  return `${formatOpportunityValue(value)} opportunity`;
}

function prepSummary(item: CallFocusItem): string {
  const actions = item.openActionCount;

  if (actions === 0) return "Ready for call";
  return `${actions} prep action${actions === 1 ? "" : "s"}`;
}

function displayCallReasons(item: CallFocusItem): string[] {
  return item.reasons.filter((reason) => !HIDDEN_CALL_REASON_LABELS.has(reason));
}

function actionTitle(action: CallFocusAction): string {
  if (action.todo.kind === "content_asset" || action.todo.kind === "deck") {
    return "Prepare and finalize material";
  }

  return action.todo.title;
}

function callIdFromHref(href: string): string | null {
  const match = href.match(/^\/calls\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function criticalActionCall(
  action: CallFocusAction,
  callsById: Map<string, Call>
): Call | undefined {
  const callId = action.todo.callId ?? callIdFromHref(action.todo.href);
  return callId ? callsById.get(callId) : undefined;
}

function criticalActionTitle(action: CallFocusAction, call?: Call): string {
  const title = actionTitle(action);
  if (!call?.accountName) return title;

  const accountSuffix = ` for ${call.accountName}`;
  return title.endsWith(accountSuffix) ? title.slice(0, -accountSuffix.length) : title;
}

function criticalActionLeadContext(action: CallFocusAction, call?: Call): string | null {
  if (!call) return action.todo.subtitle ?? null;

  const lead = call.leadName?.trim();
  const title = call.leadTitle?.trim();
  if (lead) {
    return `${lead}${title ? `, ${title}` : ""} · ${call.accountName}`;
  }

  return call.accountName;
}

function CriticalActionsCard({
  actions,
  count,
  calls,
}: {
  actions: CallFocusAction[];
  count: number;
  calls: Call[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const callsById = useMemo(
    () => new Map(calls.map((call) => [call.id, call])),
    [calls]
  );

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(actions.length - 1, 0)));
  }, [actions.length]);

  if (count === 0) return null;

  const safeIndex = Math.min(activeIndex, actions.length - 1);
  const action = actions[safeIndex];
  if (!action) return null;

  const cfg = ACTION_KIND_CONFIG[action.todo.kind];
  const Icon = cfg.icon;
  const canSwitch = actions.length > 1;
  const call = criticalActionCall(action, callsById);
  const title = criticalActionTitle(action, call);
  const leadContext = criticalActionLeadContext(action, call);

  function previous() {
    if (!canSwitch) return;
    setActiveIndex((current) => (current - 1 + actions.length) % actions.length);
  }

  function next() {
    if (!canSwitch) return;
    setActiveIndex((current) => (current + 1) % actions.length);
  }

  return (
    <Card data-critical-actions-card>
      <CardContent className="px-6 py-2.5">
        <div className="flex min-h-8 items-center gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="type-label text-foreground">Critical actions</p>
            <span className="type-caption text-muted-foreground">{count}</span>
          </div>
          <span className="hidden h-5 w-px shrink-0 bg-border sm:block" aria-hidden />
          <Link
            href={action.todo.href}
            className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/40 hover:text-primary"
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="min-w-0 flex-1 truncate type-body-sm">
              <span className="font-semibold text-foreground transition-colors group-hover:text-primary">
                {title}
              </span>
              {leadContext && (
                <span className="text-muted-foreground"> for {leadContext}</span>
              )}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={previous}
              disabled={!canSwitch}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Previous critical action"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-9 text-center type-caption tabular-nums text-muted-foreground">
              {safeIndex + 1}/{count}
            </span>
            <button
              type="button"
              onClick={next}
              disabled={!canSwitch}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Next critical action"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface RowActionLink {
  key: string;
  label: string;
}

function rowActionLinks(item: CallFocusItem): RowActionLink[] {
  if (
    item.actions.some(
      (action) => action.todo.kind === "content_asset" || action.todo.kind === "deck"
    )
  ) {
    return [{ key: "material", label: "Prepare and finalize material" }];
  }

  const links: RowActionLink[] = [];
  const seen = new Set<string>();

  function add(key: string, label: string) {
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ key, label });
  }

  for (const action of item.actions) {
    if (action.todo.kind === "content_asset" || action.todo.kind === "deck") {
      add("material", "Prepare and finalize material");
    } else if (action.todo.kind === "brief") {
      add("brief", "Review brief");
    } else if (action.todo.kind === "call_prep") {
      add("prep", item.call.status === "live" ? "Open call" : "Open prep");
    } else if (action.todo.kind === "coaching") {
      add("coaching", "Review coaching");
    } else {
      add(action.todo.kind, actionTitle(action));
    }
  }

  return links.slice(0, 1);
}

function CallActionLinks({ item }: { item: CallFocusItem }) {
  const links = rowActionLinks(item);
  const href = item.primaryHref;

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      {links.map((link) => (
        <Link
          key={link.key}
          href={href}
          data-call-focus-action={link.key}
          className="pointer-events-auto relative z-20 inline-flex items-center gap-1 type-caption font-semibold text-primary hover:underline"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ))}
    </div>
  );
}

function PriorityChip({
  item,
  isPriority,
  label,
}: {
  item: CallFocusItem;
  isPriority?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-auto relative z-20 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-semibold leading-4",
        item.call.status === "live"
          ? "border-success/25 bg-success/10 text-success"
          : "border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-400/25 dark:bg-orange-500/15 dark:text-orange-200"
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-3.5 w-3.5 appearance-none items-center justify-center rounded-full border-0 bg-current p-0 outline-none ring-offset-background transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Why ${item.call.accountName} is priority`}
          >
            <Info className="h-2.5 w-2.5 text-background" strokeWidth={3} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="max-w-xs border-black bg-black text-left text-white"
          side="top"
          style={{ borderRadius: 8, padding: "10px 14px" }}
        >
          {priorityTooltipText(item, isPriority)}
        </TooltipContent>
      </Tooltip>
      {label}
    </span>
  );
}

function ReadyForCallBadge() {
  return (
    <div className="relative z-20 inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/10 px-2 py-0.5 type-caption font-semibold text-success">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      Ready for call
    </div>
  );
}

function FocusCallRow({
  item,
  isPriority,
}: {
  item: CallFocusItem;
  isPriority?: boolean;
}) {
  const chip = statusChipText(item);
  const lead = leadName(item);
  const opportunity = opportunityLabel(item);
  const isReady = item.openActionCount === 0;
  const reasons = displayCallReasons(item);

  return (
    <section
      data-call-focus-row={item.call.id}
      className={cn(
        "group/call relative -mx-3 min-h-[6.75rem] rounded-md border-t border-border px-3 py-4 transition-colors hover:bg-muted/35 first:border-t-0 first:pt-3",
        isPriority && "border-t-primary/30"
      )}
    >
      <Link
        href={item.primaryHref}
        className="absolute inset-0 z-10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View details for ${item.call.accountName}`}
      />
      <div className="pointer-events-none relative z-20 min-w-0">
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 max-w-full shrink">
                <span className="block max-w-full truncate text-left text-[18px] font-semibold leading-tight text-foreground transition-colors group-hover/call:text-primary">
                  {item.call.accountName}
                </span>
              </h3>
              {chip && (
                <PriorityChip item={item} isPriority={isPriority} label={chip} />
              )}
            </div>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 type-caption text-muted-foreground">
              <CallQuickDetailsDialog call={item.call} prepLabel={prepSummary(item)}>
                <button
                  type="button"
                  aria-label={lead}
                  className="group/lead pointer-events-auto relative z-20 inline-flex max-w-full items-center gap-2 text-left transition-colors hover:text-primary"
                >
                  <ParticipantAvatar
                    name={lead}
                    kind="external"
                    size="xs"
                    title={lead}
                    className="shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-foreground transition-colors group-hover/lead:text-primary">
                      {lead}
                    </span>
                    {item.call.leadTitle && (
                      <span className="block max-w-[18rem] truncate text-muted-foreground transition-colors group-hover/lead:text-primary">
                        {item.call.leadTitle}
                      </span>
                    )}
                  </span>
                </button>
              </CallQuickDetailsDialog>
              <span className="h-6 w-px bg-border" aria-hidden />
              <span className="tabular-nums text-foreground">
                Agent rating {agentRating(item)}
              </span>
              {opportunity && (
                <>
                  <span className="h-6 w-px bg-border" aria-hidden />
                  <span className="tabular-nums text-foreground">
                    {" "}
                    {opportunity}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <span className="inline-flex items-center gap-1 type-caption font-semibold tabular-nums text-foreground">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {formatCallTime(item)}
            </span>
            <span className="mt-0.5 block type-caption font-medium text-muted-foreground">
              {" "}
              {remainingCallTime(item)}
            </span>
            {" "}
            <div className="mt-2 flex justify-start md:justify-end">
              {isReady ? <ReadyForCallBadge /> : <CallActionLinks item={item} />}
            </div>
          </div>
        </div>

        {reasons.length > 0 && (
          <p className="mt-2 type-caption text-muted-foreground">
            {reasons.join(" · ")}
          </p>
        )}

      </div>
    </section>
  );
}

function EmptyFocusState({ windowHours }: { windowHours: number }) {
  return (
    <div className="py-8 text-center">
      <Target className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
      <p className="type-panel-title text-foreground">
        No calls in the next {windowHours} hours
      </p>
      <p className="mx-auto mt-1 max-w-xl type-body-sm text-muted-foreground">
        Review the calendar or import fresh lead data to refresh the focus list.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild size="sm">
          <Link href="/calls">View calls</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/settings">Import data</Link>
        </Button>
      </div>
    </div>
  );
}

export function CallFocusPanel() {
  const { data: calls = [] } = useCalls();
  const { todos } = useAiTodos();
  const [doneIds, setDoneIds] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [focusWindowHours, setFocusWindowHours] = useState<FocusWindowHours>(24);

  useEffect(() => {
    setDoneIds(loadTodoDoneIds());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveTodoDoneIds(doneIds);
  }, [doneIds, hydrated]);

  const focusModel = useMemo(
    () => buildCallFocusModel({ calls, todos, doneIds, windowHours: focusWindowHours }),
    [calls, doneIds, focusWindowHours, todos]
  );

  const summary = `${focusModel.calls.length} call${
    focusModel.calls.length === 1 ? "" : "s"
  } · ${focusModel.highPriorityCallCount} high priority · ${
    focusModel.totalPrepActionCount
  } prep action${focusModel.totalPrepActionCount === 1 ? "" : "s"}`;
  const topFocusCallId =
    focusModel.calls.reduce<CallFocusItem | null>(
      (topItem, item) => (!topItem || item.score > topItem.score ? item : topItem),
      null
    )?.call.id ?? null;

  return (
    <>
      <CriticalActionsCard
        actions={focusModel.criticalActions}
        count={focusModel.criticalActionCount}
        calls={calls}
      />
      <Card>
        <CardHeader className="px-6 pb-3 pt-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-[18px] w-[18px] shrink-0 text-primary" />
                Next {focusModel.windowHours} hours
              </CardTitle>
              <p className="mt-1 type-caption text-muted-foreground">{summary}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <div
                className="inline-flex rounded-full border border-border bg-muted/30 p-px"
                aria-label="Call focus range"
              >
                {FOCUS_WINDOW_OPTIONS.map((hours) => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => setFocusWindowHours(hours)}
                    className={cn(
                      "h-6 rounded-full px-2 type-caption font-semibold leading-none transition-colors",
                      focusWindowHours === hours
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-pressed={focusWindowHours === hours}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
              <Link
                href="/calls"
                className="inline-flex items-center gap-1 type-caption font-medium text-primary hover:underline"
              >
                All calls
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 border-t border-border px-6 pb-5 pt-3">
          {focusModel.calls.length > 0 ? (
            <div className="-mr-1 max-h-[20.25rem] touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain pr-1">
              {focusModel.calls.map((item) => (
                <FocusCallRow
                  key={item.call.id}
                  item={item}
                  isPriority={item.call.id === topFocusCallId && item.priority === "high"}
                />
              ))}
            </div>
          ) : (
            <EmptyFocusState windowHours={focusModel.windowHours} />
          )}
        </CardContent>
      </Card>
    </>
  );
}
