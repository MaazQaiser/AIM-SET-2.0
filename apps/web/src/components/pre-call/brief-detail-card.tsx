"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Info, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useThemePreview } from "@/hooks/use-theme-preview";
import {
  appBodyClass,
  appCardClass,
  appDialogClass,
  appLeadClass,
  appMutedClass,
  appScrollClass,
  appScrollSidebarClass,
} from "@dc-copilot/ui/surfaces";
import { cn } from "@/lib/cn";

export interface BriefSourceInfo {
  source: string;
  detail: string;
}

/** Typography for Pre-DC main column cards (center + merged focus rail). */
export const briefMainBody = cn(appBodyClass, "[&_li]:text-base [&_p]:text-base");
export const briefMainLead = appLeadClass;
export const briefMainUnderline =
  "font-semibold underline decoration-foreground/40 underline-offset-[3px]";
export const briefMainMuted = appMutedClass;

/** Default brief / post-DC body copy — matches Pre-DC sidebar cards. */
export const briefBodyClass = "text-[0.9375rem] leading-relaxed";
export const briefBodyMutedClass = cn(briefBodyClass, "text-muted-foreground");
export const briefBodyForegroundClass = cn(briefBodyClass, "text-foreground");

/** Scrollable card regions: slim thumb, inset via scrollbar track margin. */
export const briefCardScrollClass = appScrollClass;

/** Left sidebar scroll areas — thinner thumb than main column. */
export const briefSidebarScrollClass = appScrollSidebarClass;

/** Shared shell: glass card + zero gap between header/body. */
export const briefCardShellClass = cn(appCardClass, "gap-0");

/** Outer layout shared by Summary and all Pre-DC brief cards. */
export const BRIEF_CARD_LAYOUT_CLASS = "flex min-h-0 w-full flex-col overflow-hidden";

const mainCardPadding = {
  header: "px-8 pt-5 pb-3",
  body: "px-8 pb-5 pt-0",
};
const defaultCardPadding = {
  header: "px-6 pt-5 pb-3",
  body: "px-6 pb-5 pt-0",
};

/** Mark bordered nested surfaces inside main brief cards — parent applies horizontal inset */
export const briefMainNestedSurfaceClass = "brief-main-nested";

const briefMainNestedSurfaceInset =
  "[&_.brief-main-nested]:mx-3 sm:[&_.brief-main-nested]:mx-4 [&_.glass-insight-card]:mx-3 sm:[&_.glass-insight-card]:mx-4";

export const briefStickyHeaderClassName = cn(
  "shrink-0 space-y-0",
  defaultCardPadding.header,
  "sticky top-0 z-10",
  "border-0 bg-transparent"
);

export function briefScrollBodyClassName(tone: "default" | "main" = "default", sidebar = false) {
  return cn(
    "min-h-0",
    tone === "main" ? mainCardPadding.body : defaultCardPadding.body,
    sidebar ? briefSidebarScrollClass : briefCardScrollClass,
    "flex-1 overflow-y-auto overflow-x-hidden pt-1"
  );
}

/** Detail modals on Pre-DC — same border, radius, and shadow as brief cards. */
export const briefDetailDialogClass = appDialogClass;

/** Left sidebar outer cards (Customer & account, Discovery checklist). */
export const BRIEF_SIDEBAR_CARD_SCROLL_MAX = "min(32rem,calc(100vh-8rem))";

/** Main column brief cards — same sticky header + inner scroll pattern as sidebar. */
export const BRIEF_MAIN_CARD_SCROLL_MAX = "min(40rem,calc(100vh-10rem))";

/** Relevant content — half the main column cap, scroll inside. */
export const BRIEF_RELEVANT_CONTENT_SCROLL_MAX = "min(20rem,calc((100vh - 10rem) / 2))";

export interface BriefDetailCardProps {
  title: string;
  icon?: LucideIcon;
  /** Custom header icon (e.g. brand SVG) — takes precedence over `icon` */
  headerIcon?: ReactNode;
  children: ReactNode;
  /** default = sidebar/context; main = larger body in focus column */
  tone?: "default" | "main";
  /** default = standard card; highlight = AI summary; warning = signals */
  variant?: "default" | "highlight" | "warning";
  /** Scrollable body with optional max height (e.g. "10rem" for ~3 peek rows) */
  scrollMaxHeight?: string;
  headerExtra?: ReactNode;
  sourceInfo?: BriefSourceInfo;
  className?: string;
  /** Render body only (e.g. inside a parent accordion on Pre-DC sidebar) */
  embedded?: boolean;
  /** When embedded + scroll, omit inner title if parent accordion already shows it */
  hideEmbeddedTitle?: boolean;
  /** Main column: set false to let the card grow without inner scroll */
  enableMainScroll?: boolean;
}

const stickyHeaderSurface = () => "border-0 bg-transparent";

function BriefDetailCardTitleRow({
  title,
  icon: Icon,
  headerIcon,
  headerExtra,
  sourceInfo,
  tone = "default",
  variant = "default",
  className,
}: {
  title: string;
  icon?: LucideIcon;
  headerIcon?: ReactNode;
  headerExtra?: ReactNode;
  sourceInfo?: BriefSourceInfo;
  tone?: "default" | "main";
  variant?: "default" | "highlight" | "warning";
  className?: string;
}) {
  const { isIntercom } = useThemePreview();

  return (
    <div className={cn("flex items-center justify-between gap-3 min-w-0", className)}>
      <CardTitle
        className={cn(
          "font-semibold flex items-center gap-2 min-w-0",
          tone === "main" ? "text-base" : "text-sm"
        )}
      >
        {headerIcon ??
          (Icon ? (
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                !isIntercom && variant === "highlight" && "text-primary",
                !isIntercom && variant === "warning" && "text-warning",
                isIntercom && variant === "highlight" && "text-[#ff5600]",
                isIntercom && variant === "warning" && "text-[#ff2067]"
              )}
            />
          ) : null)}
        <span className="truncate">{title}</span>
        {sourceInfo ? <SourceInfoIcon info={sourceInfo} /> : null}
        {isIntercom && variant === "warning" && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff2067]" aria-hidden />
        )}
      </CardTitle>
      {headerExtra}
    </div>
  );
}

function SourceInfoIcon({ info }: { info: BriefSourceInfo }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`How ${info.source} was used for this section`}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs space-y-1.5 p-3">
          <p className="text-[10px] font-semibold text-muted-foreground">
            Source: {info.source}
          </p>
          <p className="text-xs leading-relaxed">{info.detail}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BriefDetailCard({
  title,
  icon: Icon,
  headerIcon,
  children,
  tone = "default",
  variant = "default",
  scrollMaxHeight,
  headerExtra,
  sourceInfo,
  className,
  embedded = false,
  hideEmbeddedTitle = false,
  enableMainScroll = true,
}: BriefDetailCardProps) {
  const { isIntercom } = useThemePreview();

  const resolvedScrollMaxHeight =
    scrollMaxHeight ??
    (tone === "main" && enableMainScroll ? BRIEF_MAIN_CARD_SCROLL_MAX : undefined);
  const scrollableBody = Boolean(resolvedScrollMaxHeight);

  if (embedded) {
    if (resolvedScrollMaxHeight) {
      return (
        <div
          className={cn("flex min-h-0 min-w-0 flex-col", className)}
          style={{ maxHeight: resolvedScrollMaxHeight }}
        >
          {!hideEmbeddedTitle && (
            <div className={cn("sticky top-0 z-10 shrink-0 pb-2", stickyHeaderSurface())}>
              <BriefDetailCardTitleRow
                title={title}
                icon={Icon}
                headerIcon={headerIcon}
                headerExtra={headerExtra}
                sourceInfo={sourceInfo}
                tone={tone}
                variant={variant}
              />
            </div>
          )}
          <div
            className={cn(
              briefCardScrollClass,
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2"
            )}
          >
            {children}
          </div>
        </div>
      );
    }

    return <div className={cn("min-w-0", className)}>{children}</div>;
  }

  return (
    <Card
      className={cn(
        briefCardShellClass,
        BRIEF_CARD_LAYOUT_CLASS,
        variant === "warning" && "border-warning/35",
        isIntercom && variant === "highlight" && "border-l-[3px] border-l-[#ff5600]",
        className
      )}
      style={resolvedScrollMaxHeight ? { maxHeight: resolvedScrollMaxHeight } : undefined}
    >
      <CardHeader
        className={cn(
          scrollableBody
            ? briefStickyHeaderClassName
            : cn("shrink-0 space-y-0", tone === "main" ? mainCardPadding.header : defaultCardPadding.header)
        )}
      >
        <BriefDetailCardTitleRow
          title={title}
          icon={Icon}
          headerIcon={headerIcon}
          headerExtra={headerExtra}
          sourceInfo={sourceInfo}
          tone={tone}
          variant={variant}
        />
      </CardHeader>
      <CardContent
        className={cn(
          tone === "main" ? briefMainBody : briefBodyClass,
          tone === "main" && briefMainNestedSurfaceInset,
          scrollableBody
            ? briefScrollBodyClassName(tone)
            : cn("min-h-0", tone === "main" ? mainCardPadding.body : defaultCardPadding.body)
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/** Row inside brief cards — flat dividers only, no inner boxes. */
export function BriefDetailRow({
  children,
  className,
  plain = false,
}: {
  children: ReactNode;
  className?: string;
  /** Slightly tighter padding for label/value facts */
  plain?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-b border-border/40 last:border-b-0",
        plain ? "py-2" : "py-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Definition list for plain informational fields (industry, revenue, etc.). */
export function BriefDetailFields({
  rows,
  className,
}: {
  rows: { label: string; value: string }[];
  className?: string;
}) {
  const { isIntercom } = useThemePreview();

  return (
    <dl className={cn("space-y-4", className)}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt
            className={cn(
              isIntercom
                ? "text-xs text-[#7b7b78]"
                : "text-xs font-semibold text-muted-foreground"
            )}
          >
            {row.label}
          </dt>
          <dd className={cn(briefBodyClass, "font-medium text-foreground break-words mt-0.5")}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function BriefDetailAccordion({
  title,
  summary,
  children,
  defaultOpen = false,
  loud = false,
  main = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Sidebar section titles — slightly emphasized */
  loud?: boolean;
  /** Main column: larger title with underline */
  main?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="min-w-0 border-b border-border/30 last:border-b-0">
      <button
        type="button"
        className={cn(
          "sticky top-0 z-[9] flex w-full items-center justify-between gap-2 py-2.5 text-left text-sm min-w-0",
          "hover:opacity-80"
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "text-foreground",
              main && "text-base font-semibold underline decoration-foreground/40 underline-offset-[3px]",
              !main && loud && "text-sm font-semibold",
              !main && !loud && "text-sm font-medium"
            )}
          >
            {title}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className={cn("pb-3 pt-1", main && briefMainBody)}>{children}</div>
      )}
    </div>
  );
}
