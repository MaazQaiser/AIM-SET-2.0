import Link from "next/link";
import { QuoteIcon, ArrowRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@dc-copilot/ui/components/avatar";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import type { CoachingInsight } from "@/types";

const priorityConfig = {
  high: { variant: "destructive" as const, label: "High priority" },
  medium: { variant: "warning" as const, label: "Medium priority" },
  low: { variant: "secondary" as const, label: "Low priority" },
};

interface CoachingCardProps {
  insight: CoachingInsight;
}

export function CoachingCard({ insight }: CoachingCardProps) {
  const priority = priorityConfig[insight.priority];

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="type-label bg-accent text-accent-foreground">
                {insight.aeInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="type-panel-title text-foreground">{insight.aeName}</p>
              <p className="type-caption text-muted-foreground">{insight.pattern}</p>
            </div>
          </div>
          <Badge variant={priority.variant}>{priority.label}</Badge>
        </div>

        {/* Evidence quote */}
        {insight.evidenceQuote && (
          <div className="flex gap-2 rounded-md bg-muted/50 p-3">
            <QuoteIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
            <p className="type-caption text-muted-foreground italic line-clamp-2">
              {insight.evidenceQuote}
            </p>
          </div>
        )}

        {/* Recommendation */}
        <p className="type-body text-foreground">{insight.recommendation}</p>

        {/* Action */}
        {insight.callId && (
          <Button asChild variant="ghost" size="sm" className="h-7 -ml-2 text-primary">
            <Link href={`/calls/${insight.callId}`}>
              View call evidence
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
