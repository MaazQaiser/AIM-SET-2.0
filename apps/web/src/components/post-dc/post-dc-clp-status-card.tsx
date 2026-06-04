"use client";

import Link from "next/link";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@dc-copilot/ui/components/card";
import { Badge } from "@dc-copilot/ui/components/badge";
import type { CustomerLandingPage } from "@dc-copilot/types";
import { copyTextToClipboard } from "@/lib/clipboard";
import { toast } from "sonner";

interface PostDcClpStatusCardProps {
  callId: string;
  page?: CustomerLandingPage | null;
}

export function PostDcClpStatusCard({ callId, page }: PostDcClpStatusCardProps) {
  const status = page?.status ?? (page ? "draft" : "none");
  const stats = page?.stats;

  async function copyLink() {
    if (!page?.publicUrl) return;
    const copied = await copyTextToClipboard(page.publicUrl);
    if (copied) toast.success("Landing page link copied");
    else toast.error("Click back into the page before copying");
  }

  return (
    <Card className="app-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Customer landing page
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {status === "none" && (
          <p className="text-muted-foreground text-xs">
            Publish a personalized page for your lead with shared materials and optional proposal.
          </p>
        )}
        {status !== "none" && (
          <Badge variant={status === "published" ? "success" : "secondary"} className="text-[10px]">
            {status === "published" ? "Published" : status === "draft" ? "Draft" : "Revoked"}
          </Badge>
        )}
        {stats && status === "published" && (
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>{stats.uniqueVisitors} visitors</li>
            <li>{stats.documentOpens} document opens</li>
            <li>{stats.proposalOpens} proposal views</li>
          </ul>
        )}
        <div className="flex flex-col gap-2">
          <Button asChild size="sm" className="w-full">
            <Link href={`/calls/${callId}/landing-page`}>
              {page ? "Edit landing page" : "Prepare landing page"}
            </Link>
          </Button>
          {page?.publicUrl && status === "published" && (
            <>
              <Button variant="outline" size="sm" className="w-full" onClick={() => void copyLink()}>
                <Copy className="h-3 w-3 mr-1" />
                Copy link
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full">
                <a href={page.publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Preview public page
                </a>
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
