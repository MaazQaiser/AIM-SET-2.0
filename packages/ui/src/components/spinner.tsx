import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

interface SpinnerProps {
  className?: string;
  size?: "sm" | "default" | "lg";
}

const sizeMap = {
  sm: "h-3 w-3",
  default: "h-4 w-4",
  lg: "h-6 w-6",
};

export function Spinner({ className, size = "default" }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin text-muted-foreground", sizeMap[size], className)}
      aria-label="Loading"
    />
  );
}
