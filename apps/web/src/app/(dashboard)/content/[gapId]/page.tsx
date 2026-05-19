"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, FileText, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AIGeneratedBadge } from "@/components/ai-generated-badge";
import { CONTENT_GAPS } from "@/lib/mock-data";

const EVIDENCE = [
  { call: "Meridian Trust DC", quote: "ESG regulatory pressure is the urgency driver", anonymized: true },
  { call: "Beta Technologies DC", quote: "We need a mid-market ESG compliance brief", anonymized: true },
  { call: "Gamma FS call", quote: "Nothing in the library covers hybrid-cloud audit trails", anonymized: true },
];

export default function ContentGapDetailPage({ params }: { params: Promise<{ gapId: string }> }) {
  const { gapId } = use(params);
  const gap = CONTENT_GAPS.find((g) => g.id === gapId) ?? CONTENT_GAPS[0];
  const [notes, setNotes] = useState("Opening needs rewrite. Mark paragraphs 2–3 for refresh.");

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <Link href="/content" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" />
        Content
      </Link>

      <div className="flex items-start gap-2">
        <Lightbulb className="h-5 w-5 text-warning shrink-0 mt-0.5" />
        <div>
          <h1 className="text-xl font-semibold">{gap.topic}</h1>
          <p className="text-sm text-muted-foreground">From: {gap.sourcedFrom}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <CardTitle className="text-sm capitalize">AI draft {gap.draftType}</CardTitle>
            <AIGeneratedBadge />
            <Badge variant="warning">Priority: high</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Opening framing, three anonymized pain points from transcripts, solution outline, placeholder proof points.
          </p>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="text-sm" />
          <div className="flex gap-2">
            <Button size="sm">Approve draft</Button>
            <Button size="sm" variant="outline">
              Send back to agent
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Evidence chain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {EVIDENCE.map((e, i) => (
            <div key={i} className="text-sm border-l-2 border-primary/30 pl-3">
              <p className="font-medium text-xs text-muted-foreground">{e.call}</p>
              <p className="italic text-foreground">&ldquo;{e.quote}&rdquo;</p>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Duplicate suppression: no new draft will be generated while this item is in review.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
