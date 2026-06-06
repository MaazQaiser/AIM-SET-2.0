import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bot,
  FileText,
  GraduationCap,
  Home,
  Phone,
  Settings,
  Shield,
} from "lucide-react";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const mainNavItems: SidebarNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/calls", label: "Calls", icon: Phone },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/content", label: "Knowledge Base", icon: FileText },
  { href: "/coaching", label: "Coaching", icon: GraduationCap },
  { href: "/governance", label: "Governance", icon: Shield },
  { href: "/analytics/landing-pages", label: "Lead hubs", icon: FileText },
];

export type FooterNavItem =
  | { kind: "button"; label: string; icon: LucideIcon }
  | { kind: "link"; href: string; label: string; icon: LucideIcon | "account" };

export const footerNavItems: FooterNavItem[] = [
  { label: "Notification", kind: "button", icon: Bell },
  { href: "/settings", label: "Settings", kind: "link", icon: Settings },
  { href: "/settings", label: "Account", kind: "link", icon: "account" },
];

export interface SidebarWidgetCard {
  href: string;
  title: string;
  subtitle: string;
}

export const sidebarWidgetCards: SidebarWidgetCard[] = [
  { href: "/content", title: "Knowledge Base", subtitle: "" },
];

const PAGE_TITLES: Record<string, string> = {
  "/": "Sales Plan Overview",
  "/calls": "Calls",
  "/agents": "Agents",
  "/content": "Knowledge Base",
  "/coaching": "Coaching",
  "/governance": "Governance",
  "/settings": "Settings",
  "/knowledge/projects": "Knowledge Base",
  "/knowledge": "Knowledge Base",
  "/analytics/landing-pages": "Lead hub analytics",
};

export function getSidebarPageTitle(pathname: string): string {
  if (pathname === "/") return PAGE_TITLES["/"] ?? "Sales Plan Overview";

  const match = Object.keys(PAGE_TITLES)
    .filter((p) => p !== "/" && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];

  return match ? (PAGE_TITLES[match] ?? "Sales Plan Overview") : PAGE_TITLES["/"];
}
