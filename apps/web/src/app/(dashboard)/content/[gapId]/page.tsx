"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useContentGaps } from "@/lib/data/hooks";

const EVIDENCE = [
  { call: "Meridian Trust DC", quote: "ESG regulatory pressure is the urgency driver", anonymized: true },
  { call: "Beta Technologies DC", quote: "We need a mid-market ESG compliance brief", anonymized: true },
  { call: "Gamma FS call", quote: "Nothing in the library covers hybrid-cloud audit trails", anonymized: true },
];

export default function ContentGapDetailPage({ params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = use(params);
  const { data: gaps = [] } = useContentGaps();
  const gap = gaps.find((g) => g.id === gapId);
  const [notes, setNotes] = useState("Opening needs rewrite. Mark paragraphs 2–3 for refresh.");

  if (!gap) {
    return (
      <div className="p-6">
        <Link href="/content" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ChevronLeft className="h-4 w-4" />
          Content
        </Link>
        <EmptyState icon={Lightbulb} title="Content gap not found" description="No gap data is available yet." />
      </div>
    );
  }

  const title = gap.topic;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Link href="/content" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Content
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Content gap studio</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            AI draft
            <AIGeneratedBadge />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Evidence chain</p>
            {EVIDENCE.map((e) => (
              <div key={e.call} className="rounded-md border p-2 text-xs">
                <Badge variant="outline" className="mb-1">
                  {e.call}
                </Badge>
                <p className="italic text-muted-foreground">&ldquo;{e.quote}&rdquo;</p>
              </div>
            ))}
          </div>
          <Button>Submit for review</Button>
        </CardContent>
      </Card>
    </div>
  );
}
