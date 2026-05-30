"use client";

import { UserButton } from "@clerk/nextjs";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@dc-copilot/ui/components/button";
import { PersonaSwitcher } from "@/components/layout/persona-switcher";
import { useClerkGate } from "@/components/providers/clerk-gate";
import { isLocalAuthBypassEnabled } from "@/lib/auth-mode";

export function TopBar() {
  const { theme, setTheme } = useTheme();
  const clerkEnabled = useClerkGate();

  return (
    <header className="relative z-10 flex h-14 items-center justify-between bg-transparent px-6">
      {/* Left: breadcrumb or page title slot */}
      <div id="topbar-title" className="flex items-center gap-3" />

      {/* Right: floating glass controls */}
      <div className="flex items-center gap-2">
        <PersonaSwitcher />

        <Button
          variant="ghost"
          size="icon"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 dark:-rotate-90 dark:scale-0 transition-transform" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 dark:rotate-0 dark:scale-100 transition-transform" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          className="relative"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-warning" />
        </Button>

        {isLocalAuthBypassEnabled() || !clerkEnabled ? (
          <div className="ml-1 flex h-9 items-center rounded-xl border border-border/60 bg-card px-3 type-caption font-medium text-muted-foreground shadow-soft-xs">
            {isLocalAuthBypassEnabled() ? "Local dev" : "Auth not configured"}
          </div>
        ) : (
          <div className="ml-1 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card shadow-soft-xs">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        )}
      </div>
    </header>
  );
}
