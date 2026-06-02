import { cn } from "@/lib/cn";

type PageShellSize = "default" | "narrow" | "wide" | "full";

const MAX_WIDTH: Record<PageShellSize, string> = {
  default: "max-w-6xl",
  narrow: "max-w-3xl",
  wide: "max-w-[1480px]",
  full: "max-w-none",
};

interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /** default 1152px · narrow 768px · wide 1480px · full bleed */
  size?: PageShellSize;
}

/** Consistent dashboard page padding and max-width. */
export function PageShell({ children, className, size = "default" }: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6 p-6 sm:p-8", MAX_WIDTH[size], className)}>
      {children}
    </div>
  );
}
