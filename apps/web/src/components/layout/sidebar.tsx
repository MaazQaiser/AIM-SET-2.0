"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Phone,
  BookOpen,
  TrendingUp,
  FileText,
  Settings,
  Bot,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useState } from "react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Home" },
  { href: "/calls", icon: Phone, label: "Calls" },
  { href: "/knowledge", icon: BookOpen, label: "Knowledge" },
  { href: "/coaching", icon: TrendingUp, label: "Coaching" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/content", icon: FileText, label: "Content" },
  { href: "/governance", icon: Shield, label: "Governance" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarProps {
  defaultCollapsed?: boolean;
}

export function Sidebar({ defaultCollapsed = true }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <aside
      className={cn(
        "relative z-[1] flex h-full shrink-0 flex-col bg-transparent transition-all duration-200",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center",
          collapsed ? "justify-center" : "px-4"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-warning text-warning-foreground shadow-soft-xs">
          <span className="text-[10px] font-bold">DC</span>
        </div>
        {!collapsed && (
          <span className="ml-3 type-title text-foreground">DC Copilot</span>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 p-3",
          collapsed && "items-center"
        )}
      >
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={cn(
                "flex items-center rounded-xl type-body-sm font-medium transition-colors",
                collapsed
                  ? "h-9 w-9 shrink-0 justify-center p-0"
                  : "h-9 gap-3 px-3",
                isActive
                  ? "bg-card text-foreground shadow-card"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="glass absolute -right-3 top-20 flex h-7 w-7 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
