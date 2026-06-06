"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Bot, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { cn } from "@/lib/cn";

const WRAPUP_PLACEHOLDER = "Ask about follow-up email, next steps, or open gaps…";

const WRAPUP_STARTERS = [
  "Draft follow-up email",
  "Summarize call",
  "Open BANT gaps",
  "Jira handoff",
] as const;

const PREP_PLACEHOLDER = "Ask DC Copilot about prep, talk tracks, or discovery…";

const PREP_STARTERS = ["Opening script", "BANT gaps", "Objection prep", "Competitive angle"] as const;

export interface FloatingAiChatBarProps {
  phase?: "prep" | "wrapup";
  className?: string;
}

/** Visual-only floating copilot dock — matches pre-DC bar styling; no backend wiring. */
export function FloatingAiChatBar({ phase = "wrapup", className }: FloatingAiChatBarProps) {
  const [expanded, setExpanded] = useState(false);
  const [inputWide, setInputWide] = useState(false);
  const [input, setInput] = useState("");
  const dockRef = useRef<HTMLDivElement>(null);

  const placeholder = phase === "wrapup" ? WRAPUP_PLACEHOLDER : PREP_PLACEHOLDER;
  const starters = phase === "wrapup" ? WRAPUP_STARTERS : PREP_STARTERS;
  const dockExpanded = inputWide || expanded;

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (event: MouseEvent) => {
      if (dockRef.current && !dockRef.current.contains(event.target as Node)) {
        setExpanded(false);
        setInputWide(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [expanded]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
  }

  return (
    <div
      ref={dockRef}
      className={cn(
        "call-detail-urbanist fixed bottom-10 left-1/2 z-50 flex -translate-x-1/2 flex-col pointer-events-none",
        "transition-[width] duration-300 ease-out",
        dockExpanded ? "w-[min(calc(100%-2.5rem),42rem)]" : "w-[min(calc(100%-5rem),19rem)]",
        className
      )}
      aria-label="DC Copilot floating chat"
    >
      <div
        className={cn(
          "call-detail-liquid-glass call-detail-liquid-glass--dock pointer-events-auto w-full overflow-hidden transition-[border-radius] duration-300 ease-out",
          dockExpanded ? "rounded-2xl" : "rounded-full",
          expanded && "call-detail-liquid-glass--expanded"
        )}
      >
        {expanded ? (
          <div className="call-detail-copilot-panel-body flex min-h-[240px] max-h-[min(420px,50vh)] flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="call-detail-copilot-divider flex items-center gap-2 border-b px-4 py-2.5 shrink-0">
                <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate text-sm font-medium text-[#111111]">AI Copilot</span>
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-[#111111] hover:bg-white/40"
                    aria-label="Minimize copilot"
                    onClick={() => {
                      setExpanded(false);
                      setInputWide(false);
                    }}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <p className="call-detail-copilot-muted call-detail-copilot-divider shrink-0 border-b px-4 py-1.5 text-[10px]">
                {phase === "wrapup"
                  ? "Post-call assistant — draft emails, next steps, and handoffs."
                  : "Pre-call assistant — prep questions, talk tracks, and discovery coaching."}
              </p>

              <div className="call-detail-copilot-divider flex flex-wrap gap-2 border-b px-4 py-2.5 shrink-0">
                {starters.map((label) => (
                  <button
                    key={label}
                    type="button"
                    className="call-detail-copilot-suggested-btn rounded-full border px-2.5 py-1 text-[11px] font-medium text-[#111111]/80 transition-colors hover:bg-white/40"
                    onClick={() => setInput(label)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="call-detail-copilot-messages flex flex-1 flex-col justify-center overflow-y-auto px-4 py-6 min-h-0">
                <div className="mx-auto max-w-sm space-y-3 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" aria-hidden />
                  </div>
                  <p className="call-detail-copilot-muted text-sm leading-relaxed">
                    Copilot preview — chat responses are not wired yet on this screen.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Type a question below to see the input bar; full AI replies coming soon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className={cn(
            "call-detail-copilot-input-bar flex shrink-0 flex-col gap-2",
            expanded && "border-t call-detail-copilot-divider"
          )}
        >
          <div className="flex min-h-[3.25rem] items-center gap-2 py-2 pl-4 pr-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => {
                setInputWide(true);
                setExpanded(true);
              }}
              placeholder={placeholder}
              className="call-detail-copilot-search-input min-w-0 flex-1 border-0 bg-transparent pl-1 text-sm text-[#111111] outline-none"
              aria-label="Ask DC Copilot"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send"
              className="h-9 w-9 shrink-0 rounded-full bg-[#111111] text-white hover:bg-[#111111]/90 disabled:bg-[#111111]/40"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
