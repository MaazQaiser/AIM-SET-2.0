"use client";

import { useMemo } from "react";
import {
  Customized,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { scoreToTone } from "@/lib/live/sentiment-display";
import { cn } from "@/lib/cn";
import type { SentimentSignal, TranscriptEvent } from "@/types";

type SentimentTone = "positive" | "neutral" | "negative";

type SentimentPoint = {
  id: string;
  timestamp: number;
  score: number;
  tone: SentimentTone;
  current?: boolean;
};

function clampScore(score: number): number {
  return Math.max(-1, Math.min(1, score));
}

function sentimentToScore(
  sentiment: "positive" | "negative" | "neutral",
  index: number
): number {
  if (sentiment === "positive") return 0.75;
  if (sentiment === "negative") return -0.75;
  return index % 2 === 0 ? 0.1 : -0.1;
}

function toneColor(tone: SentimentTone): string {
  if (tone === "positive") return "hsl(var(--success))";
  if (tone === "negative") return "hsl(var(--destructive))";
  return "hsl(var(--muted-foreground))";
}

function toneLabel(tone: SentimentTone): string {
  if (tone === "positive") return "Positive";
  if (tone === "negative") return "Negative";
  return "Neutral";
}

function segmentOpacity(tone: SentimentTone): number {
  if (tone === "neutral") return 0.35;
  return 0.95;
}

function buildSentimentPoints(
  sentimentSignals: SentimentSignal[],
  transcript: TranscriptEvent[],
  customerScore: number
): SentimentPoint[] {
  const currentTone = scoreToTone(customerScore);
  const customerSignals = sentimentSignals.filter((s) => s.speakerRole === "customer");

  if (customerSignals.length > 0) {
    const history = customerSignals.slice(-8).map((signal) => ({
      id: signal.id,
      timestamp: signal.timestamp,
      score: clampScore(signal.score),
      tone: signal.tone,
      current: false,
    }));

    const lastTimestamp = history[history.length - 1]?.timestamp ?? 0;
    return [
      ...history,
      {
        id: `current-${currentTone}-${Math.round(customerScore * 100)}`,
        timestamp: lastTimestamp + 1,
        score: clampScore(customerScore),
        tone: currentTone,
        current: true,
      },
    ];
  }

  const withSentiment = transcript
    .filter((e) => e.speakerRole === "customer" && e.sentiment)
    .slice(-12);

  if (withSentiment.length > 0) {
    const history = withSentiment.slice(-7).map((e, index) => ({
      id: e.id || `${e.timestamp}-${index}`,
      timestamp: e.timestamp,
      score: sentimentToScore(e.sentiment as "positive" | "negative" | "neutral", index),
      tone: e.sentiment as SentimentTone,
      current: false,
    }));
    const lastTimestamp = history[history.length - 1]?.timestamp ?? 0;
    return [
      ...history,
      {
        id: `current-${currentTone}-${Math.round(customerScore * 100)}`,
        timestamp: lastTimestamp + 1,
        score: clampScore(customerScore),
        tone: currentTone,
        current: true,
      },
    ];
  }

  const fallbackScore =
    currentTone === "positive" ? 0.55 : currentTone === "negative" ? -0.55 : 0.08;

  return Array.from({ length: 6 }, (_, i) => ({
    id: `fallback-${i}`,
    timestamp: i * 20,
    score: i === 5 ? fallbackScore : i < 2 ? 0.06 : fallbackScore * 0.5,
    tone: (i === 5 ? currentTone : "neutral") as SentimentTone,
    current: i === 5,
  }));
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SentimentDot({
  cx,
  cy,
  payload,
}: {
  cx?: number;
  cy?: number;
  payload?: SentimentPoint;
}) {
  if (cx == null || cy == null || !payload) return null;

  const fill = toneColor(payload.tone);
  const r = payload.current ? 4.5 : 3.25;

  if (payload.current) {
    return (
      <g data-current-sentiment="true" data-sentiment-tone={payload.tone}>
        <circle cx={cx} cy={cy} r={r + 3} fill={fill} fillOpacity={0.15} stroke="none" />
        <circle
          cx={cx}
          cy={cy}
          r={r + 1.5}
          fill="none"
          stroke={fill}
          strokeOpacity={0.45}
          strokeWidth={1.5}
        />
        <circle cx={cx} cy={cy} r={r} fill={fill} stroke="hsl(var(--background))" strokeWidth={2} />
      </g>
    );
  }

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={fill}
      stroke="hsl(var(--background))"
      strokeWidth={1.5}
      data-sentiment-tone={payload.tone}
    />
  );
}

function SentimentTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload?: SentimentPoint }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-sm">
      <p className="text-muted-foreground">Time {formatTime(label ?? point.timestamp)}</p>
      <p className="mt-0.5 font-semibold" style={{ color: toneColor(point.tone) }}>
        {toneLabel(point.tone)}
      </p>
    </div>
  );
}

type ChartCustomizedProps = {
  xAxisMap?: Record<string, { scale?: (value: number) => number }>;
  yAxisMap?: Record<string, { scale?: (value: number) => number }>;
  points: SentimentPoint[];
};

function SentimentSegmentLayer({ xAxisMap, yAxisMap, points }: ChartCustomizedProps) {
  const xScale = xAxisMap ? Object.values(xAxisMap)[0]?.scale : undefined;
  const yScale = yAxisMap ? Object.values(yAxisMap)[0]?.scale : undefined;
  if (!xScale || !yScale || points.length < 2) return null;

  return (
    <g aria-hidden>
      {points.slice(1).map((point, index) => {
        const prev = points[index];
        const x1 = xScale(prev.timestamp);
        const y1 = yScale(prev.score);
        const x2 = xScale(point.timestamp);
        const y2 = yScale(point.score);
        if ([x1, y1, x2, y2].some((value) => typeof value !== "number" || Number.isNaN(value))) {
          return null;
        }

        return (
          <line
            key={`${prev.id}-${point.id}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={toneColor(point.tone)}
            strokeWidth={point.tone === "neutral" ? 1.5 : 2.5}
            strokeOpacity={segmentOpacity(point.tone)}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
}

export function LiveSentimentLineChart({
  transcript,
  customerScore,
  sentimentSignals = [],
  compact = false,
  className,
}: {
  transcript: TranscriptEvent[];
  customerScore: number;
  sentimentSignals?: SentimentSignal[];
  compact?: boolean;
  className?: string;
}) {
  const points = useMemo(
    () => buildSentimentPoints(sentimentSignals, transcript, customerScore),
    [sentimentSignals, transcript, customerScore]
  );

  const segmentLayer = useMemo(
    () =>
      function SegmentLayer(props: Record<string, unknown>) {
        return (
          <SentimentSegmentLayer
            xAxisMap={props.xAxisMap as ChartCustomizedProps["xAxisMap"]}
            yAxisMap={props.yAxisMap as ChartCustomizedProps["yAxisMap"]}
            points={points}
          />
        );
      },
    [points]
  );

  if (points.length < 2) {
    return (
      <p className="py-2 text-xs text-muted-foreground">
        Sentiment timeline will appear as the conversation progresses.
      </p>
    );
  }

  return (
    <div
      className={cn("w-full", compact ? "h-20 min-w-[5rem] max-w-full" : "h-24", className)}
      aria-label="Customer sentiment over the call"
      data-testid="sentiment-timeline-chart"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 8, bottom: 2, left: -16 }}>
          <XAxis
            dataKey="timestamp"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatTime}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[-1, 1]}
            ticks={[-0.75, 0, 0.75]}
            tickFormatter={(value) => (value > 0.35 ? "+" : value < -0.35 ? "−" : "·")}
            tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={22}
          />
          <Tooltip content={<SentimentTooltip />} />
          <Customized component={segmentLayer} />
          <Line
            dataKey="score"
            type="linear"
            stroke="transparent"
            strokeWidth={0}
            dot={(props) => <SentimentDot {...props} payload={props.payload as SentimentPoint} />}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
