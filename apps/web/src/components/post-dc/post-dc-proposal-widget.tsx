"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { useClpProposal, useGenerateClpProposal } from "@/lib/data/clp-hooks";
import type { ClpProposal } from "@dc-copilot/types";
import { toast } from "sonner";

interface PostDcProposalWidgetProps {
  callId: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function proposalPreviewText(proposal: ClpProposal): string {
  if (proposal.sections.length > 0) {
    const firstBody = proposal.sections.find((section) => section.bodyHtml?.trim())?.bodyHtml;
    if (firstBody) return stripHtml(firstBody);
  }
  return stripHtml(proposal.html);
}

export function PostDcProposalWidget({ callId }: PostDcProposalWidgetProps) {
  const { data: proposal } = useClpProposal(callId);
  const generate = useGenerateClpProposal(callId);

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="type-panel-title flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Quick proposal (TCS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 type-body">
        <p className="type-caption text-muted-foreground">
          AI-drafted proposal from discovery outcomes, BANT signals, and timeline — review before
          attaching to the landing page.
        </p>

        {proposal ? (
          <div className="space-y-3 rounded-md border border-border">
            <div className="border-b border-border px-3 py-2 type-label">
              <p className="font-medium text-foreground">{proposal.title}</p>
              <p className="mt-0.5 text-muted-foreground">
                v{proposal.version} · {proposal.status.replaceAll("_", " ")}
              </p>
            </div>

            {proposal.sections.length > 0 ? (
              <ul className="divide-y divide-border">
                {proposal.sections.map((section) => (
                  <li key={section.id} className="px-3 py-2.5">
                    <p className="type-label text-foreground">{section.title}</p>
                    {section.bodyHtml ? (
                      <p className="mt-1 line-clamp-3 type-caption leading-snug text-muted-foreground">
                        {stripHtml(section.bodyHtml)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 pb-3 type-caption leading-snug text-muted-foreground line-clamp-4">
                {proposalPreviewText(proposal)}
              </p>
            )}

          </div>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          disabled={generate.isPending}
          onClick={() => {
            generate.mutate(undefined, {
              onSuccess: () => toast.success("Proposal draft ready — review it below."),
              onError: () => toast.error("Could not generate proposal"),
            });
          }}
        >
          {generate.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <FileText className="h-3 w-3 mr-1" />
          )}
          {proposal ? "Regenerate draft" : "Generate quick proposal"}
        </Button>
      </CardContent>
    </Card>
  );
}
