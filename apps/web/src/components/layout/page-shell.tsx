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

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/** Page content shell — transparent; official canvas is `.page-hue` on `<body>`. */
export function PageShell({ children, className, size = "default" }: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full space-y-6 p-6 sm:p-8", MAX_WIDTH[size], className)}>
      {children}
    </div>
  );
}

export function PageHeader({ children, className, ...props }: PageHeaderProps) {
  return (
    <header
      {...props}
      className={cn(
        "sticky top-0 z-30 -mx-6 shrink-0 border-b border-border/60 bg-background/90 px-6 py-4 backdrop-blur-md sm:-mx-8 sm:px-8",
        className
      )}
    >
      {children}
    </header>
  );
}
