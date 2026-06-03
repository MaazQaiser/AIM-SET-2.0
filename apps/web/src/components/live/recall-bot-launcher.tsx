"use client";

import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@dc-copilot/ui/components/tooltip";
import { useLiveCall } from "@/stores/use-live-call";
import type { TranscriptEvent } from "@/types";
import { AlertCircle, Bot, CheckCircle2, Send } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

interface RecallBotLauncherProps {
  callId: string;
  meetingUrl?: string;
}

function displayLaunchError(message: string): string {
  if (message.startsWith("PUBLIC_API_BASE_URL is not reachable")) {
    return "API tunnel is not reachable. Update PUBLIC_API_BASE_URL in services/api/.env and restart the API.";
  }
  if (message.startsWith("PUBLIC_API_BASE_URL must be")) {
    return "API tunnel URL is invalid. Set PUBLIC_API_BASE_URL to a public HTTPS API URL, not the meeting link.";
  }
  return message;
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
        throw new Error(body.error ?? body.detail ?? `Recall bot launch failed (${res.status})`);
      }
      launchedUrlRef.current = meetingUrlValue;
      setStatus("ready");
      setMessage(body.botId ? `Bot invited: ${body.botId}` : "Bot invited");
      // Start polling Recall API as fallback for unreliable webhooks
      startPolling();
    } catch (err) {
      setStatus("error");
      setMessage(
        displayLaunchError(err instanceof Error ? err.message : "Recall bot launch failed")
      );
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

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appendTranscriptEvent = useLiveCall((s) => s.appendTranscriptEvent);

  function startPolling() {
    if (pollRef.current) return;
    const pollOnce = () => {
      void (async () => {
        try {
          const res = await fetch(`/api/calls/${encodeURIComponent(callId)}/poll-transcript`, {
            method: "POST",
          });
          if (!res.ok) return;
          const data = (await res.json()) as {
            events?: Array<{
              id?: string;
              speaker_id?: string;
              speaker_name?: string;
              speaker_role?: string;
              text?: string;
              offset_seconds?: number;
              keywords?: string[];
            }>;
          };
          // Directly push new transcript events into the store
          for (const ev of data.events ?? []) {
            const mapped: TranscriptEvent = {
              id: ev.id ?? crypto.randomUUID(),
              speakerId: ev.speaker_id ?? "unknown",
              speakerName: ev.speaker_name ?? ev.speaker_id ?? "Speaker",
              speakerRole: (ev.speaker_role as TranscriptEvent["speakerRole"]) ?? "customer",
              text: ev.text ?? "",
              timestamp: ev.offset_seconds ?? 0,
              keywords: ev.keywords ?? [],
            };
            appendTranscriptEvent(mapped);
          }
        } catch {
          // ignore poll errors
        }
      })();
    };
    pollOnce();
    pollRef.current = setInterval(pollOnce, 2000);
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

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
