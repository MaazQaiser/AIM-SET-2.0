"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { appSidebarWidgetClass } from "@dc-copilot/ui/surfaces";
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

export function SidebarKbWidgetCard({ className }: { className?: string }) {
  const { setExpanded } = useSidebar();
  const { data: assets = [] } = useKbAssets();
  const { toGenerateCount, isLoading: contentStatsLoading } = useContentManagerSidebarStats();

  const contentSubtitle = formatContentSubtitle(assets.length, toGenerateCount, contentStatsLoading);

  return (
    <div className={cn(styles.navKbCardWrap, className)}>
      <div className={cn(styles.kbStackScene, styles.navKbStackScene)} aria-hidden>
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
    </div>
  );
}
