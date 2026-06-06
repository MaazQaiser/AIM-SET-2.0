"use client";

import Link from "next/link";
import { Lightbulb, X } from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent } from "@dc-copilot/ui/components/card";
import { KbUploadButton } from "@/components/knowledge/kb-upload-button";

interface SuggestionContextBarProps {
  brief?: Record<string, unknown>;
  onDismiss?: () => void;
}

export function SuggestionContextBar({ brief, onDismiss }: SuggestionContextBarProps) {
  const plan = brief?.suggestion_plan as
    | { lead_count?: number; plan_summary?: string; evidence?: { projects?: Array<{ title: string }> } }
    | undefined;
  if (!brief || (!brief.generation_reason && !brief.asset_name && !plan)) return null;

  const source = brief.source === "post-dc" ? "Post-DC" : brief.source === "pre-dc" ? "Pre-DC" : "Suggestion";
  const account = String(brief.account_name || "");
  const callId = brief.call_id ? String(brief.call_id) : undefined;
  const suggestionPlan = brief.suggestion_plan as
    | {
        evidence?: { projects?: unknown[]; kb_assets?: unknown[] };
        slide_plan?: Array<{ mode?: string }>;
      }
    | undefined;
  const projectCount = suggestionPlan?.evidence?.projects?.length ?? 0;
  const kbCount = suggestionPlan?.evidence?.kb_assets?.length ?? 0;
  const slideCount = suggestionPlan?.slide_plan?.length ?? 0;
  const reuseCount = suggestionPlan?.slide_plan?.filter((slide) => slide.mode === "reuse").length ?? 0;
  const leadCount = Number(brief.lead_count || plan?.lead_count || 0);
  const projects = plan?.evidence?.projects ?? [];

  return (
    <Card className="border-warning/30 bg-warning/5 shrink-0">
      <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Lightbulb className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm font-medium truncate">{String(brief.asset_name || "Suggested content")}</p>
            <Badge variant="outline" className="shrink-0">
              {source}
            </Badge>
            {leadCount > 1 && (
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {leadCount} leads
              </Badge>
            )}
          </div>
          {plan?.plan_summary ? (
            <p className="text-xs text-muted-foreground">{plan.plan_summary}</p>
          ) : null}
          {brief.generation_reason ? (
            <p className="text-xs text-muted-foreground">{String(brief.generation_reason)}</p>
          ) : null}
          {brief.needed_for ? (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Needed for: </span>
              {String(brief.needed_for)}
            </p>
          ) : null}
          {projects.length > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Projects: </span>
              {projects.map((p) => p.title).join(", ")}
            </p>
          )}
          {account && (
            <p className="text-xs text-muted-foreground">
              Account: {account}
              {callId && (
                <>
                  {" · "}
                  <Link href={`/calls/${callId}`} className="underline underline-offset-2">
                    View call
                  </Link>
                </>
              )}
            </p>
          )}
          {(projectCount > 0 || kbCount > 0 || slideCount > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {projectCount > 0 && <Badge variant="secondary">{projectCount} project proof{projectCount === 1 ? "" : "s"}</Badge>}
              {kbCount > 0 && <Badge variant="secondary">{kbCount} KB asset{kbCount === 1 ? "" : "s"}</Badge>}
              {slideCount > 0 && <Badge variant="outline">{slideCount} planned slide{slideCount === 1 ? "" : "s"}</Badge>}
              {reuseCount > 0 && <Badge variant="outline">{reuseCount} reuse slide{reuseCount === 1 ? "" : "s"}</Badge>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <KbUploadButton
            defaultTitle={String(brief.asset_name || "")}
            trigger={
              <Button size="sm" variant="outline">
                Upload instead
              </Button>
            }
          />
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss} aria-label="Dismiss suggestion context">
              <X className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="secondary" asChild>
            <Link href="/content?tab=suggestions">All suggestions</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
