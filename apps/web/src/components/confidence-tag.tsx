import { AlertTriangle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

interface ConfidenceTagProps {
  score: number;
  className?: string;
}

export function ConfidenceTag({ score, className }: ConfidenceTagProps) {
  // High confidence: no render
  if (score >= 0.8) return null;

  if (score >= 0.5) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-sm border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-xs font-medium text-warning-foreground",
          className
        )}
        title={`Confidence score: ${Math.round(score * 100)}%`}
      >
        <AlertTriangle className="h-3 w-3" />
        Low confidence
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive",
        className
      )}
      title={`Confidence score: ${Math.round(score * 100)}%`}
    >
      <AlertCircle className="h-3 w-3" />
      Unverified
    </span>
  );
}
