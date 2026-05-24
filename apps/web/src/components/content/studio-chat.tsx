"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { useStudioMessage } from "@/lib/data/content-studio-hooks";
import type { StudioTurnResult } from "@/types/content_studio";

interface Message {
  id: string;
  role: string;
  content: Record<string, unknown>;
  turnType?: string | null;
}

export function StudioChat({
  projectId,
  messages,
  onTurn,
  selectedTemplateId,
}: {
  projectId: string;
  messages: Message[];
  onTurn: (result: StudioTurnResult) => void;
  selectedTemplateId?: string;
}) {
  const [input, setInput] = useState("");
  const send = useStudioMessage(projectId);

  async function handleSend() {
    if (!input.trim() || send.isPending) return;
    const text = input.trim();
    setInput("");
    const envelope = await send.mutateAsync({
      message: text,
      templateId: selectedTemplateId,
      generate: false,
    });
    onTurn(envelope.result);
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-lg bg-card">
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[320px]">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Describe what you want to create — deck, one-pager, or image. The agent will clarify your
            needs, suggest templates, then generate HTML you can preview and tweak.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 rounded-md bg-primary/10 p-3 text-sm"
                : "mr-8 rounded-md bg-muted/60 p-3 text-sm"
            }
          >
            <p className="text-xs font-medium text-muted-foreground mb-1 capitalize">{m.role}</p>
            <pre className="whitespace-pre-wrap font-sans text-foreground">
              {String((m.content as { text?: string }).text ?? JSON.stringify(m.content, null, 2))}
            </pre>
          </div>
        ))}
        {send.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating…
          </div>
        )}
      </div>
      <div className="p-3 border-t border-border flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell the agent what to build or how to tweak the preview…"
          rows={2}
          className="resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
        />
        <Button size="icon" onClick={() => void handleSend()} disabled={send.isPending || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
