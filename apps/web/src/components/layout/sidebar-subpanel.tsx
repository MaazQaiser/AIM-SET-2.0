"use client";

import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { appSidebarWidgetClass } from "@dc-copilot/ui/surfaces";
import { SidebarAiInsightCard } from "./sidebar-ai-insight-card";
import { useContentManagerSidebarStats, useKbAssets } from "@/lib/data/hooks";
import { sidebarWidgetCards } from "./sidebar-nav-config";
import { useSidebar } from "./sidebar-context";
import { SidebarKbDocumentsStack } from "./sidebar-kb-stack";
import styles from "./sidebar.module.css";

function formatContentSubtitle(assetCount: number, toGenerateCount: number, loading: boolean) {
  if (loading && assetCount === 0 && toGenerateCount === 0) return "Loading…";
  const parts: string[] = [];
  parts.push(`${assetCount.toLocaleString()} asset${assetCount === 1 ? "" : "s"}`);
  if (toGenerateCount > 0) {
    parts.push(`${toGenerateCount.toLocaleString()} to generate`);
  }
  return parts.join(" · ");
}

export function SidebarSubpanel() {
  const { setExpanded } = useSidebar();
  const { data: assets = [] } = useKbAssets();
  const { toGenerateCount, isLoading: contentStatsLoading } = useContentManagerSidebarStats();

  const contentSubtitle = formatContentSubtitle(assets.length, toGenerateCount, contentStatsLoading);

  return (
    <div className={styles.widgetsColumn} aria-label="Sidebar widgets">
      <button
        type="button"
        className={styles.closeButton}
        aria-label="Close sidebar"
        onClick={() => setExpanded(false)}
      >
        <X className="h-4 w-4" strokeWidth={1.5} />
      </button>

      <SidebarAiInsightCard />

      <div className={styles.kbStackScene} aria-hidden>
        <SidebarKbDocumentsStack className={styles.kbStackSvg} />
      </div>

      {sidebarWidgetCards.map((card) => (
        <Link
          key={card.href + card.title}
          href={card.href}
          className={cn(appSidebarWidgetClass, styles.widgetCard, styles.kbWidgetCard)}
          onClick={() => setExpanded(false)}
        >
          <span className={styles.widgetCardText}>
            <span className={styles.widgetCardTitle}>{card.title}</span>
            <span className={cn(styles.widgetCardSubtitle, styles.widgetCardSubtitleLg)}>
              {contentSubtitle}
            </span>
          </span>
          <ChevronRight className={styles.widgetCardIcon} strokeWidth={1.5} aria-hidden />
        </Link>
      ))}

      <div className={styles.widgetsScrollbar} aria-hidden />
    </div>
  );
}
