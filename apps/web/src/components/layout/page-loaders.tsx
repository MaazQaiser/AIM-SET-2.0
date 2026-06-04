import { Skeleton } from "@dc-copilot/ui/components/skeleton";
import { cn } from "@/lib/cn";

type PageLoaderSize = "default" | "narrow" | "wide" | "full";

const MAX_WIDTH: Record<PageLoaderSize, string> = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  wide: "max-w-[1480px]",
  full: "max-w-none",
};

function PageLoaderShell({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  size?: PageLoaderSize;
}) {
  return (
    <div
      className={cn("mx-auto w-full space-y-6 p-6 sm:p-8", MAX_WIDTH[size], className)}
      aria-busy="true"
      aria-label="Loading page"
    >
      {children}
    </div>
  );
}

/** Home dashboard — greeting + briefing + agenda grid. */
export function DashboardPageLoader() {
  return (
    <PageLoaderShell className="space-y-1.5">
      <Skeleton className="h-16 w-full max-w-2xl rounded-xl" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid gap-3 lg:grid-cols-[1fr_1.2fr]">
        <Skeleton className="h-[320px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
    </PageLoaderShell>
  );
}

/** Calls list — page header + tabs + table/card grid. */
export function CallsListPageLoader() {
  return (
    <PageLoaderShell size="wide" className="flex min-h-0 flex-1 flex-col space-y-6">
      <div className="space-y-2 pt-2">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-[420px] w-full rounded-xl" />
    </PageLoaderShell>
  );
}

/** Pre-DC call brief — sticky header + two-column widget layout. */
export function CallDetailPageLoader() {
  return (
    <PageLoaderShell size="wide" className="call-detail-page space-y-4 pb-8">
      <div className="space-y-3 rounded-xl border border-border/60 p-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      </div>
    </PageLoaderShell>
  );
}

/** Post-DC review — header + sidebar + tabbed content. */
export function PostDcPageLoader() {
  return (
    <PageLoaderShell size="wide" className="max-w-[1400px] space-y-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="grid gap-8 lg:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]">
        <Skeleton className="h-56 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </PageLoaderShell>
  );
}

/** Live call cockpit — full-height transcript + insights columns. */
export function LiveCallPageLoader() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden" aria-busy="true" aria-label="Loading live call">
      <div className="shrink-0 space-y-3 border-b border-border/60 px-6 py-4 sm:px-8">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden px-6 py-4 sm:px-8">
        <Skeleton className="min-h-0 flex-1 rounded-xl" />
        <Skeleton className="hidden min-h-0 w-[380px] rounded-xl xl:block" />
      </div>
    </div>
  );
}

/** Generic list/detail pages (knowledge, agents, settings). */
export function GenericPageLoader({ size = "default" }: { size?: PageLoaderSize }) {
  return (
    <PageLoaderShell size={size}>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </PageLoaderShell>
  );
}
