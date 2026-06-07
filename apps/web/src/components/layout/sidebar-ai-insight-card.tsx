"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { cn } from "@/lib/cn";
import { appCardClass } from "@dc-copilot/ui/surfaces";
import { useAiTodos, type AiTodo } from "@/hooks/use-ai-todos";
import { SidebarAiInsightDots } from "./sidebar-ai-insight-dots";
import styles from "./sidebar.module.css";

function insightMessage(todos: AiTodo[]): string {
  const top = todos[0];
  if (top?.subtitle?.trim()) return top.subtitle.trim();
  if (top?.title?.trim()) return top.title.trim();
  return "Press ⌘K to search";
}

export function SidebarAiInsightCard() {
  const { todos } = useAiTodos();
  const message = insightMessage(todos);

  return (
    <div className={styles.aiInsightWrap}>
      <article className={cn(appCardClass, styles.aiInsightCard)}>
        <div className={styles.aiInsightContent}>
          <header className={styles.aiInsightHeader}>
            <h2 className={styles.aiInsightTitle}>AI Insight</h2>
            <Link
              href="/home"
              className={styles.aiInsightHomeLink}
              aria-label="Go to home"
            >
              <Home className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            </Link>
          </header>
          <p className={styles.aiInsightBody}>{message}</p>
        </div>
        <SidebarAiInsightDots className={styles.aiInsightDotsSvg} />
      </article>
    </div>
  );
}
