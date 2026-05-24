"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button onClick={reset} variant="outline">Try again</Button>
    </div>
  );
}
