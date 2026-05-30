"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";
import { useSidebar } from "./sidebar-context";
import { SidebarRail } from "./sidebar-rail";
import { SidebarExpandedPanel } from "./sidebar-expanded-panel";
import styles from "./sidebar.module.css";

export function Sidebar() {
  const { expanded, setExpanded } = useSidebar();

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [expanded, setExpanded]);

  return (
    <>
      {!expanded && <SidebarRail />}

      <div
        className={cn(styles.overlayRoot, expanded && styles.overlayRootOpen)}
        aria-hidden={!expanded}
      >
        <button
          type="button"
          className={styles.backdrop}
          aria-label="Close sidebar"
          tabIndex={expanded ? 0 : -1}
          onClick={() => setExpanded(false)}
        />

        <aside
          className={cn(styles.panelShell, expanded && styles.panelShellExpanded)}
          aria-label="Main navigation"
          aria-hidden={!expanded}
          inert={!expanded ? true : undefined}
        >
          <SidebarExpandedPanel />
        </aside>
      </div>
    </>
  );
}
