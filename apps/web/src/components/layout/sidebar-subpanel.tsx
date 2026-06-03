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

function formatAssetCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "Asset" : "Assets"}`;
}

function formatToGenerateCount(count: number, loading: boolean) {
  if (loading && count === 0) return "Loading…";
  return `${count.toLocaleString()} to generate`;
}

export function SidebarSubpanel() {
  const { setExpanded } = useSidebar();
  const { data: assets = [] } = useKbAssets();
  const {
    toGenerateCount,
    isLoading: contentStatsLoading,
  } = useContentManagerSidebarStats();

  const assetCountLabel = formatAssetCount(assets.length);
  const generateCountLabel = formatToGenerateCount(toGenerateCount, contentStatsLoading);

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

      <Link
        href="/knowledge"
        className={cn(appSidebarWidgetClass, styles.widgetCard, styles.kbWidgetCard)}
        onClick={() => setExpanded(false)}
      >
        <span className={styles.widgetCardText}>
          <span className={styles.widgetCardTitle}>Knowledge Base</span>
          <span className={styles.widgetCardSubtitle}>{assetCountLabel}</span>
        </span>
        <ChevronRight className={styles.widgetCardIcon} strokeWidth={1.5} aria-hidden />
      </Link>

      {sidebarWidgetCards.slice(1).map((card) => (
        <Link
          key={card.href + card.title}
          href={card.href}
          className={cn(appSidebarWidgetClass, styles.widgetCard)}
          onClick={() => setExpanded(false)}
        >
          <span className={styles.widgetCardText}>
            <span className={styles.widgetCardTitle}>{card.title}</span>
            <span
              className={cn(
                styles.widgetCardSubtitle,
                card.title === "Content Manager" && styles.widgetCardSubtitleLg
              )}
            >
              {card.title === "Content Manager" ? generateCountLabel : card.subtitle}
            </span>
          </span>
          <ChevronRight className={styles.widgetCardIcon} strokeWidth={1.5} aria-hidden />
        </Link>
      ))}

      <div className={styles.widgetsScrollbar} aria-hidden />
    </div>
  );
}
