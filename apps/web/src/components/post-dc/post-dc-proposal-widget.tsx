"use client";

import { FileText, Loader2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { useClpProposal, useGenerateClpProposal } from "@/lib/data/clp-hooks";
import { toast } from "sonner";

interface PostDcProposalWidgetProps {
  callId: string;
}

export function PostDcProposalWidget({ callId }: PostDcProposalWidgetProps) {
  const { data: proposal } = useClpProposal(callId);
  const generate = useGenerateClpProposal(callId);

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Quick proposal (TCS)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          AI-drafted proposal from discovery outcomes, BANT signals, and timeline — review before
          attaching to the landing page.
        </p>
        {proposal ? (
          <p className="text-xs">
            <span className="font-medium">{proposal.title}</span> · v{proposal.version} ·{" "}
            {proposal.status}
          </p>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={generate.isPending}
          onClick={() => {
            generate.mutate(undefined, {
              onSuccess: () => toast.success("Proposal draft ready"),
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
