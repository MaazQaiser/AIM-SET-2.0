"use client";

import { Tabs, TabsList, TabsTrigger } from "@dc-copilot/ui/components/tabs";
import { cn } from "@/lib/cn";

export type PostDcScreenTab =
  | "overview"
  | "account-prep"
  | "client-landing"
  | "transcript"
  | "coach";

export const POST_DC_SCREEN_TAB_ITEMS: { id: PostDcScreenTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "account-prep", label: "Account & prep" },
  { id: "client-landing", label: "Client Landing Page" },
  { id: "transcript", label: "Transcript" },
  { id: "coach", label: "AI Coach" },
];

const SWITCHER_TABS_LIST_CLASS = cn(
  "h-auto w-full shrink-0 justify-start gap-6 overflow-x-auto rounded-none border-b border-border/60 bg-transparent p-0"
);

interface PostDcScreenTabsProps {
  value: PostDcScreenTab;
  onChange: (tab: PostDcScreenTab) => void;
  embedded?: boolean;
  className?: string;
}

/** Top-level Post-DC view switcher. */
export function PostDcScreenTabs({
  value,
  onChange,
  embedded = false,
  className,
}: PostDcScreenTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as PostDcScreenTab)}
      className={cn("min-w-0", className)}
    >
      <TabsList className={cn(SWITCHER_TABS_LIST_CLASS, embedded && "gap-4")}>
        {POST_DC_SCREEN_TAB_ITEMS.map((tab) => (
          <TabsTrigger
            key={tab.id}
            value={tab.id}
            className={cn("shrink-0 type-body", embedded && "type-label")}
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
