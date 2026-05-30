"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  mainNavItems,
  footerNavItems,
  getSidebarPageTitle,
} from "./sidebar-nav-config";
import { useSidebar } from "./sidebar-context";
import { SidebarSubpanel } from "./sidebar-subpanel";
import {
  SummitLogo,
  SidebarSearchIcon,
  SidebarAccountAvatar,
} from "./sidebar-icons";
import styles from "./sidebar.module.css";

function NavIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <Icon className={styles.sidebarIcon} size={18} strokeWidth={1.5} aria-hidden />
  );
}

function FooterIcon({ icon }: { icon: LucideIcon | "account" }) {
  if (icon === "account") {
    return <SidebarAccountAvatar />;
  }
  const Icon = icon;
  return (
    <Icon className={styles.sidebarIcon} size={18} strokeWidth={1.5} aria-hidden />
  );
}

export function SidebarExpandedPanel() {
  const pathname = usePathname();
  const pageTitle = getSidebarPageTitle(pathname);
  const { setExpanded } = useSidebar();

  return (
    <>
      <div className={styles.navColumn}>
        <div className={styles.navHeaderBlock}>
          <div className={styles.brandRow}>
            <SummitLogo />
          </div>

          <div className={styles.titleSearchBlock}>
            <h1 className={styles.pageTitle}>
              {pageTitle === "Sales Plan Overview" ? (
                <>
                  Sales Plan
                  <br />
                  Overview
                </>
              ) : (
                pageTitle
              )}
            </h1>

            <label className={styles.searchField}>
              <SidebarSearchIcon />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Press ⌘K to search"
                aria-label="Search"
              />
            </label>
          </div>
        </div>

        <nav className={styles.primaryNav} aria-label="Primary">
          {mainNavItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(styles.navLink, isActive && styles.navLinkActive)}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setExpanded(false)}
              >
                <NavIcon icon={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footerNav}>
          {footerNavItems.map((item) => {
            const isActive =
              item.kind === "link" && pathname.startsWith(item.href);

            const rowClass = cn(
              styles.footerRow,
              isActive && styles.footerRowActive
            );

            if (item.kind === "button") {
              return (
                <button
                  key={item.label}
                  type="button"
                  className={rowClass}
                  aria-label={item.label}
                >
                  <span className={styles.footerIconWrap}>
                    <FooterIcon icon={item.icon} />
                  </span>
                  <span className={styles.footerLabel}>{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={rowClass}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setExpanded(false)}
              >
                <span className={styles.footerIconWrap}>
                  <FooterIcon icon={item.icon} />
                </span>
                <span className={styles.footerLabel}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <SidebarSubpanel />
    </>
  );
}
