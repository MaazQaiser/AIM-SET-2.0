"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  appNavItemActiveClass,
  appNavItemClass,
  appNavLinkActiveClass,
  appNavLinkClass,
  appSidebarPanelClass,
  appSidebarWidgetClass,
  appCardClass,
} from "@dc-copilot/ui/surfaces";
import { mainNavItems, footerNavItems } from "./sidebar-nav-config";
import { ClpNotificationBell } from "@/components/notifications/clp-notification-bell";
import { useSidebar } from "./sidebar-context";
import {
  SummitLogoMark,
  SidebarAccountAvatar,
} from "./sidebar-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./sidebar.module.css";

function RailIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon className={styles.sidebarIcon} size={18} strokeWidth={1.5} aria-hidden />
  );
}

function FooterRailIcon({ icon }: { icon: LucideIcon | "account" }) {
  if (icon === "account") {
    return <SidebarAccountAvatar />;
  }
  const Icon = icon;
  return (
    <Icon className={styles.sidebarIcon} size={18} strokeWidth={1.5} aria-hidden />
  );
}

function RailTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarRail() {
  const pathname = usePathname();
  const { setExpanded } = useSidebar();

  return (
    <aside className={styles.collapsedRail} aria-label="Main navigation">
      <SummitLogoMark className={styles.railLogoMark} />

      <RailTooltip label="Open sidebar">
        <button
          type="button"
          className={cn(appNavItemClass, styles.railIconButton)}
          aria-label="Open sidebar"
          onClick={() => setExpanded(true)}
        >
          <PanelLeftOpen className={styles.sidebarIcon} size={18} strokeWidth={1.5} />
        </button>
      </RailTooltip>

      <div className={styles.railPrimaryNavWrap}>
        <nav className={styles.railPrimaryNav} aria-label="Primary">
          {mainNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <RailTooltip key={item.href} label={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    appNavItemClass,
                    styles.railIconButton,
                    isActive && appNavItemActiveClass
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <RailIcon icon={item.icon} />
                </Link>
              </RailTooltip>
            );
          })}
        </nav>
      </div>

      <footer className={styles.railFooter}>
        {footerNavItems.map((item) => {
          const isActive =
            item.kind === "link" && pathname.startsWith(item.href);

          const buttonClass = cn(
            appNavItemClass,
            styles.railIconButton,
            isActive && appNavItemActiveClass
          );

          if (item.kind === "button" && item.label === "Notification") {
            return (
              <div key={item.label} className={buttonClass}>
                <ClpNotificationBell />
              </div>
            );
          }

          if (item.kind === "button") {
            return (
              <RailTooltip key={item.label} label={item.label}>
                <button
                  type="button"
                  className={buttonClass}
                  aria-label={item.label}
                >
                  <FooterRailIcon icon={item.icon} />
                </button>
              </RailTooltip>
            );
          }

          return (
            <RailTooltip key={item.label} label={item.label}>
              <Link
                href={item.href}
                className={buttonClass}
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <FooterRailIcon icon={item.icon} />
              </Link>
            </RailTooltip>
          );
        })}
      </footer>
    </aside>
  );
}
