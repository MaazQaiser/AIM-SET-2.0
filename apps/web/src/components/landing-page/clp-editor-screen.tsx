"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dc-copilot/ui/components/dialog";
import { ClpPublicView } from "@/components/landing-page/clp-public-view";
import { ClpKbAssetsPanel } from "@/components/landing-page/clp-kb-assets-panel";
import { ClpSectionEditor } from "@/components/landing-page/clp-section-editor";
import { PostDcProposalWidget } from "@/components/post-dc/post-dc-proposal-widget";
import {
  useClpProposal,
  useGenerateLandingPage,
  useLandingPage,
  usePublishLandingPage,
  useUpdateLandingPage,
} from "@/lib/data/clp-hooks";
import { useCall } from "@/lib/data/hooks";
import { syncAssetSections } from "@/lib/landing-page/clp-editor-utils";
import { toast } from "sonner";
import type { CustomerLandingPage } from "@dc-copilot/types";

interface ClpEditorScreenProps {
  callId: string;
}

export function ClpEditorScreen({ callId }: ClpEditorScreenProps) {
  const { data: call } = useCall(callId);
  const { data: page, isLoading, refetch } = useLandingPage(callId);
  const { data: proposal } = useClpProposal(callId);
  const generate = useGenerateLandingPage(callId);
  const update = useUpdateLandingPage(callId);
  const publish = usePublishLandingPage(callId);
  const [draft, setDraft] = useState<CustomerLandingPage | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [password, setPassword] = useState("");
  const autoGenerateAttempted = useRef(false);

  useEffect(() => {
    if (page) setDraft(syncAssetSections(page));
  }, [page]);

  useEffect(() => {
    if (isLoading || page || generate.isPending || autoGenerateAttempted.current) return;
    autoGenerateAttempted.current = true;
    generate.mutate(undefined, {
      onSuccess: (p) => setDraft(syncAssetSections(p)),
      onError: () => toast.error("Could not generate landing page draft"),
    });
  }, [isLoading, page, generate.isPending]);

  function saveDraft(next: CustomerLandingPage) {
    const synced = syncAssetSections(next);
    setDraft(synced);
    update.mutate(
      {
        sections: synced.sections,
        selectedAssets: synced.selectedAssets,
        branding: synced.branding,
        settings: synced.settings,
      },
      { onError: () => toast.error("Save failed") }
    );
  }

  if (!draft && (isLoading || generate.isPending)) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Could not load landing page.</p>
        <Button className="mt-4" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-col">
      <div className="border-b px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href={`/calls/${callId}/post-dc`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Customer landing page</h1>
            <p className="text-sm text-muted-foreground">{call?.accountName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              generate.mutate(undefined, {
                onSuccess: (p) => {
                  setDraft(syncAssetSections(p));
                  toast.success("AI draft refreshed");
                },
              })
            }
          >
            Refresh AI draft
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="h-3 w-3 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 min-h-0">
        <div className="overflow-y-auto border-r bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview as customer</p>
          <ClpPublicView page={draft} proposal={proposal ?? null} preview />
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          <PostDcProposalWidget callId={callId} />
          <ClpSectionEditor draft={draft} onChange={saveDraft} />
          <ClpKbAssetsPanel draft={draft} onChange={saveDraft} />
          {proposal && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <p className="font-medium">Proposal attached</p>
              <p className="text-muted-foreground mt-1">{proposal.title}</p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish landing page</DialogTitle>
            <DialogDescription>
              Set a password your lead will use to access this page. They will also enter their name
              and email each visit.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            placeholder="Password (min 6 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={password.length < 6 || publish.isPending}
              onClick={() => {
                publish.mutate(password, {
                  onSuccess: (p) => {
                    setDraft(syncAssetSections(p));
                    setPublishOpen(false);
                    toast.success("Landing page published");
                  },
                  onError: () => toast.error("Publish failed"),
                });
              }}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
