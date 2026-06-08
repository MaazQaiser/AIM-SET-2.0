"use client";

import { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeModeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
          {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Dark mode</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch between light and dark appearance.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-muted-foreground">
          {isDark ? "Dark" : "Light"}
        </span>
        <Switch.Root
          aria-label="Toggle dark mode"
          checked={isDark}
          className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-muted transition-colors duration-200 data-[state=checked]:bg-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!mounted}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        >
          <Switch.Thumb className="block h-6 w-6 translate-x-0.5 rounded-full bg-background shadow-soft-sm transition-transform duration-200 data-[state=checked]:translate-x-[1.375rem]" />
        </Switch.Root>
      </div>
    </div>
  );
}
