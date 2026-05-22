"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Bot, CheckCircle2, Send } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

interface RecallBotLauncherProps {
  callId: string;
  meetingUrl?: string;
}

export function RecallBotLauncher({ callId, meetingUrl }: RecallBotLauncherProps) {
  const [value, setValue] = useState(meetingUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ready" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const launchedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (meetingUrl && !value) {
      setValue(meetingUrl);
    }
  }, [meetingUrl, value]);

  async function doLaunch(meetingUrlValue: string) {
    if (!meetingUrlValue || loading || status === "ready") return;
    // Prevent duplicate launches for the same URL
    if (launchedUrlRef.current === meetingUrlValue) return;

    setLoading(true);
    setStatus("idle");
    setMessage(null);

    try {
      const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/recall-bot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingUrl: meetingUrlValue }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        botId?: string;
      };
      if (!res.ok) {
        throw new Error(
          body.error ?? body.detail ?? `Recall bot launch failed (${res.status})`
        );
      }
      launchedUrlRef.current = meetingUrlValue;
      setStatus("ready");
      setMessage(body.botId ? `Bot invited: ${body.botId}` : "Bot invited");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Recall bot launch failed");
    } finally {
      setLoading(false);
    }
  }

  async function launchBot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const meetingUrlValue = value.trim();
    if (!meetingUrlValue) {
      setStatus("error");
      setMessage("Meeting URL is required");
      return;
    }
    await doLaunch(meetingUrlValue);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").trim();
    if (pasted && /^https?:\/\/.+/.test(pasted)) {
      setValue(pasted);
      // Auto-launch after paste
      setTimeout(() => void doLaunch(pasted), 0);
    }
  }

  return (
    <form className="flex min-w-0 items-center gap-2" onSubmit={(event) => void launchBot(event)}>
      <Bot className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
      <Input
        aria-label="Meeting URL"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPaste={handlePaste}
        placeholder="Meeting URL"
        className="h-7 w-[180px] min-w-0 text-xs sm:w-[260px] lg:w-[320px]"
        disabled={loading || status === "ready"}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="submit"
            variant="outline"
            size="icon-sm"
            className="h-7 w-7"
            loading={loading}
            disabled={loading || status === "ready"}
            aria-label="Start Recall bot"
          >
            {!loading && <Send className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Start Recall bot</TooltipContent>
      </Tooltip>
      {status !== "idle" && message && (
        <span
          className={
            status === "ready"
              ? "flex max-w-[220px] items-center gap-1 truncate text-xs text-emerald-600"
              : "flex max-w-[280px] items-center gap-1 truncate text-xs text-destructive"
          }
          title={message}
        >
          {status === "ready" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{message}</span>
        </span>
      )}
    </form>
  );
}
