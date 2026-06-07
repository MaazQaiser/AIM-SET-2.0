import { SummitLogo } from "@/components/layout/sidebar-icons";
import { cn } from "@/lib/cn";

const highlights = [
  {
    title: "Pre-call briefs",
    description: "Account research, BANT prep, and relevant content before you join.",
  },
  {
    title: "Live DC copilot",
    description: "Transcript, AI prompts, and qualification metrics in one workspace.",
  },
  {
    title: "Post-call review",
    description: "Summaries, follow-ups, and deck-ready outputs when the call ends.",
  },
];

export function AuthBrandPanel({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex flex-col justify-center px-4 py-10 lg:px-8 lg:py-16",
        className
      )}
    >
      <SummitLogo />

      <div className="mt-10 max-w-md">
        <p className="type-caption font-medium text-muted-foreground">
          Discovery Call platform
        </p>
        <h1 className="mt-2 type-page-title leading-tight text-foreground lg:text-[1.75rem]">
          AI-native sales discovery, from brief to follow-up
        </h1>
        <p className="app-muted mt-3">
          Prepare smarter, run cleaner live calls, and close the loop with structured post-DC
          workflows.
        </p>
      </div>

      <ul className="mt-10 hidden max-w-md space-y-0 lg:block">
        {highlights.map((item, index) => (
          <li
            key={item.title}
            className={cn(
              "py-4",
              index > 0 && "border-t border-border"
            )}
          >
            <p className="type-panel-title text-foreground">{item.title}</p>
            <p className="mt-1 type-body leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </aside>
  );
}

interface AuthFormHeaderProps {
  title: string;
  description: string;
}

export function AuthFormHeader({ title, description }: AuthFormHeaderProps) {
  return (
    <div className="mb-6 w-full max-w-md text-left lg:hidden">
      <SummitLogo />
      <h2 className="mt-6 type-screen-title text-foreground">{title}</h2>
      <p className="app-muted mt-1">{description}</p>
    </div>
  );
}

export function AuthFormPanel({
  title,
  description,
  children,
  className,
}: AuthFormHeaderProps & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center justify-center px-4 py-10 lg:items-start lg:px-8 lg:py-16",
        className
      )}
    >
      <div className="hidden w-full max-w-md lg:block">
        <h2 className="type-screen-title text-foreground">{title}</h2>
        <p className="app-muted mt-1">{description}</p>
      </div>

      <AuthFormHeader title={title} description={description} />

      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

export function AuthSetupNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="app-card mx-auto max-w-md space-y-3 p-6 text-center">
      <h1 className="type-section-title text-foreground">{title}</h1>
      <div className="app-muted type-body [&_code]:rounded [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:type-caption">
        {children}
      </div>
    </div>
  );
}
