"use client";

import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  appCardClass,
  appSidebarWidgetClass,
} from "@dc-copilot/ui/surfaces";
import { resolveCallBrief } from "@/lib/dc-data/resolvers";
import { useKbAssets, useContentGaps, useCalls } from "@/lib/data/hooks";
import { useDcImportsStore } from "@/stores/use-dc-imports";
import { sidebarWidgetCards } from "./sidebar-nav-config";
import { useSidebar } from "./sidebar-context";
import { SidebarKbDocumentsStack } from "./sidebar-kb-stack";
import styles from "./sidebar.module.css";

function formatAssetCount(count: number) {
  return `${count.toLocaleString()} ${count === 1 ? "Asset" : "Assets"}`;
}

function formatToGenerateCount(count: number) {
  return `${count.toLocaleString()} to generate`;
}

export function SidebarSubpanel() {
  const { setExpanded } = useSidebar();
  const { data: assets = [] } = useKbAssets();
  const { data: gaps = [] } = useContentGaps();
  const { data: calls = [] } = useCalls();
  useDcImportsStore((state) => state.importVersion ?? 0);

  const pendingGaps = gaps.filter((gap) => gap.status !== "approved").length;
  const fromBriefs = calls.reduce((total, call) => {
    const brief = resolveCallBrief(call.id);
    return total + (brief?.contentToGenerate?.length ?? 0);
  }, 0);

  const contentToGenerateCount = pendingGaps + fromBriefs;

  const assetCountLabel = formatAssetCount(assets.length);
  const generateCountLabel = formatToGenerateCount(contentToGenerateCount);

  return (
    <div className={styles.widgetsColumn} aria-label="Sidebar widgets">
      <div className={styles.widgetsTop}>
        <button
          type="button"
          className={styles.closeButton}
          aria-label="Close sidebar"
          onClick={() => setExpanded(false)}
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>

        <div className={styles.aiInsightWrap}>
          <article className={cn(appCardClass, styles.aiInsightCard)}>
            <header className={styles.aiInsightHeader}>
              <h2 className={styles.aiInsightTitle}>AI Insight</h2>
              <ChevronRight className={styles.widgetCardIcon} strokeWidth={1.5} aria-hidden />
            </header>
            <p className={styles.aiInsightBody}>
              Press ⌘K to searchPress ⌘K to searchPress ⌘K to searchPress ⌘K to
              searchPress ⌘K to
            </p>
            <div className={styles.aiInsightDots} aria-hidden />
          </article>
        </div>
      </div>

      <div className={styles.widgetsMiddle}>
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
      </div>

      <div className={styles.widgetsBottom}>
        <div className={styles.contentStack}>
          <div className={styles.contentStackLayer3} aria-hidden />
          <div className={styles.contentStackLayer2} aria-hidden />
          <div className={styles.contentStackTop}>
            <span>case study</span>
            <span className={styles.contentStackRule} aria-hidden />
            <span>32</span>
          </div>
        </div>

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
      </div>

      <div className={styles.widgetsScrollbar} aria-hidden />
    </div>
  );
}
