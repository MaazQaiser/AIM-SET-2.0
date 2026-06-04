"use client";

import { Card, CardContent, CardHeader } from "@dc-copilot/ui/components/card";

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className ?? "h-4 w-full"}`} />;
}

export function DashboardSkeletonSections() {
  return (
    <>
      <Card>
        <CardContent className="space-y-3 p-5">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
          <SkeletonBlock className="h-4 w-2/3" />
        </CardContent>
      </Card>

      <div className="grid gap-1.5 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <Card className="h-full">
          <CardHeader className="pb-3">
            <SkeletonBlock className="h-5 w-36" />
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {[1, 2, 3].map((i) => (
              <SkeletonBlock key={i} className="h-14 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
        <Card className="flex h-[360px] flex-col">
          <CardHeader className="shrink-0 pb-3">
            <SkeletonBlock className="h-5 w-28" />
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto pt-0">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-12 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
