"use client";

import { use } from "react";
import Link from "next/link";
import { ChevronLeft, QuoteIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AE_COACHING_TRANSPARENCY } from "@/lib/mock-data";

const EVIDENCE_BY_AE: Record<string, typeof AE_COACHING_TRANSPARENCY> = {
  "ae-sarah": AE_COACHING_TRANSPARENCY,
  default: AE_COACHING_TRANSPARENCY,
};

export default function CoachingAePage({ params }: { params: Promise<{ aeId: string }> }) {
  const { aeId } = use(params);
  const data = EVIDENCE_BY_AE[aeId] ?? EVIDENCE_BY_AE.default;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Link href="/coaching" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Coaching
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{data.aeName}</h1>
        <p className="text-sm text-muted-foreground mt-1">Individual scorecard · transcript evidence</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Pattern: commitment-anchoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.moments.map((m, i) => (
            <div key={i} className="rounded-md border p-4 space-y-2">
              <div className="flex items-start gap-2">
                <QuoteIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-sm italic text-foreground">&ldquo;{m.quote}&rdquo;</p>
              </div>
              <p className="text-xs text-muted-foreground">{m.context}</p>
              <Badge variant="outline" className="text-xs">
                Evidence moment {i + 1}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Coaching prompts are surfaced as patterns, not verdicts. Discuss with {data.managerName} in your 1:1.
      </p>
    </div>
  );
}
