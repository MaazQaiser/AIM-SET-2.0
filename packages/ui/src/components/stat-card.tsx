import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/cn";
import { Card, CardContent } from "./card";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, description, icon: Icon, trend, className }: StatCardProps) {
  const isPositive = trend && trend.value >= 0;

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {Icon && (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent">
              <Icon className="h-4 w-4 text-accent-foreground" />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between">
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {trend && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-medium",
                isPositive ? "text-success" : "text-destructive"
              )}
            >
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              <span>
                {isPositive ? "+" : ""}
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
