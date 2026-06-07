"use client";

import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent } from "@dc-copilot/ui/components/card";

export function DashboardImportPrompt() {
  return (
    <Card className="border-dashed border-primary/30 bg-primary/5">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Upload className="h-4 w-4" />
          </div>
          <div>
            <p className="type-panel-title text-foreground">Import your leads to unlock the full dashboard</p>
            <p className="mt-0.5 type-caption text-muted-foreground">
              Upload pre_dc_notes_data.csv in Settings. Calls, agenda, and AI todos use your imported data.
            </p>
          </div>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link href="/settings">Go to data import</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
