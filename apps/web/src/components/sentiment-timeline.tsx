"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SentimentPoint {
  timestamp: number;
  aeScore: number;
  customerScore: number;
}

interface SentimentTimelineProps {
  data: SentimentPoint[];
  className?: string;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function SentimentTimeline({ data, className }: SentimentTimelineProps) {
  if (data.length < 2) return null;

  return (
    <div
      className={className}
      style={{ minHeight: 80 }}
      aria-label={`Sentiment timeline from ${formatTime(data[0]?.timestamp ?? 0)} to ${formatTime(data[data.length - 1]?.timestamp ?? 0)}`}
    >
      <ResponsiveContainer width="100%" height={80}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
          <defs>
            <linearGradient id="aeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="customerGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatTime}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[-1, 1]}
            ticks={[-1, 0, 1]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--popover-foreground))",
              fontSize: "12px",
            }}
            labelFormatter={(v) => `Time: ${formatTime(v as number)}`}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", paddingTop: "4px" }}
          />
          <Area
            type="monotone"
            dataKey="aeScore"
            name="AE"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#aeGradient)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="customerScore"
            name="Customer"
            stroke="hsl(var(--success))"
            strokeWidth={2}
            fill="url(#customerGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
