"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bot,
  FileText,
  Mail,
  TrendingUp,
  ChevronRight,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAiTodos, type AiTodo, type AiTodoAgent } from "@/hooks/use-ai-todos";
import { cn } from "@/lib/cn";

const AGENT_CONFIG: Record<
  AiTodoAgent,
  { icon: React.ElementType; label: string; className: string }
> = {
  "live-call": { icon: Bot, label: "Live Call", className: "text-primary bg-primary/10" },
  content: {
    icon: FileText,
    label: "Content",
    className: "text-purple-600 bg-purple-100 dark:bg-purple-950/40 dark:text-purple-300",
  },
  coaching: { icon: TrendingUp, label: "Coaching", className: "text-warning bg-warning/10" },
  task: {
    icon: Mail,
    label: "Task",
    className: "text-indigo-600 bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300",
  },
};

const PRIORITY_DOT: Record<AiTodo["priority"], string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-muted-foreground/50",
};

function TodoRow({
  todo,
  done,
  onToggle,
}: {
  todo: AiTodo;
  done: boolean;
  onToggle: () => void;
}) {
  const cfg = AGENT_CONFIG[todo.agent];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        done ? "opacity-50 bg-muted/30" : "bg-card hover:bg-muted/40"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
        aria-label={done ? "Mark incomplete" : "Mark complete"}
      >
        {done ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <span
            className={cn("block h-2.5 w-2.5 rounded-full", PRIORITY_DOT[todo.priority])}
          />
        )}
      </button>
      <TodoRowIcon cfg={cfg} Icon={Icon} />
      <TodoRowContent todo={todo} done={done} cfg={cfg} />
      <Link
        href={todo.href}
        className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
        aria-label="Open"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function TodoRowIcon({
  cfg,
  Icon,
}: {
  cfg: (typeof AGENT_CONFIG)[AiTodoAgent];
  Icon: React.ElementType;
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
        cfg.className
      )}
    >
      <Icon className="h-4 w-4" />
    </div>
  );
}

function TodoRowContent({
  todo,
  done,
  cfg,
}: {
  todo: AiTodo;
  done: boolean;
  cfg: (typeof AGENT_CONFIG)[AiTodoAgent];
}) {
  return (
    <div className="flex-1 min-w-0">
      <p
        className={cn(
          "text-sm font-medium text-foreground",
          done && "line-through text-muted-foreground"
        )}
      >
        {todo.title}
      </p>
      {todo.subtitle && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{todo.subtitle}</p>
      )}
      <p className="text-[10px] text-muted-foreground mt-0.5">{cfg.label} Agent</p>
    </div>
  );
}

export function AiTodoList() {
  const { todos, counts } = useAiTodos();
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());
  const openCount = todos.filter((t) => !doneIds.has(t.id)).length;

  function toggle(id: string) {
    setDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            For you, today
          </CardTitle>
          {openCount > 0 && (
            <Badge variant="secondary" className="tabular-nums">
              {openCount}
            </Badge>
          )}
        </div>
        {counts.high > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {counts.high} high priority · AI-derived from agent activity
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {todos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center rounded-lg border border-dashed bg-muted/20">
            <CheckCircle2 className="h-8 w-8 text-success mb-2" />
            <p className="text-sm font-medium">You&apos;re all caught up</p>
            <p className="text-xs text-muted-foreground mt-1">The agents are quiet.</p>
          </div>
        ) : (
          todos.map((todo) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              done={doneIds.has(todo.id)}
              onToggle={() => toggle(todo.id)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
