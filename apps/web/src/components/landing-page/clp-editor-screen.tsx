"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, Loader2, Send } from "lucide-react";
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
import { PostDcProposalWidget } from "@/components/post-dc/post-dc-proposal-widget";
import {
  useClpProposal,
  useGenerateLandingPage,
  useLandingPage,
  usePublishLandingPage,
  useUpdateLandingPage,
} from "@/lib/data/clp-hooks";
import { useCall } from "@/lib/data/hooks";
import { toast } from "sonner";
import type { ClpSection, CustomerLandingPage } from "@dc-copilot/types";

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

  useEffect(() => {
    if (page) setDraft(page);
  }, [page]);

  useEffect(() => {
    if (!isLoading && !page && !generate.isPending) {
      generate.mutate(undefined, {
        onSuccess: (p) => setDraft(p),
        onError: () => toast.error("Could not generate landing page draft"),
      });
    }
  }, [isLoading, page, generate.isPending]);

  function saveDraft(next: CustomerLandingPage) {
    setDraft(next);
    update.mutate(
      {
        sections: next.sections,
        selectedAssets: next.selectedAssets,
        branding: next.branding,
        settings: next.settings,
      },
      { onError: () => toast.error("Save failed") }
    );
  }

  function toggleSection(id: string) {
    if (!draft) return;
    const sections = draft.sections.map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s
    );
    saveDraft({ ...draft, sections });
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
          <Button variant="outline" size="sm" onClick={() => generate.mutate()}>
            Refresh AI draft
          </Button>
          <Button size="sm" onClick={() => setPublishOpen(true)}>
            <Send className="h-3 w-3 mr-1" />
            Publish
          </Button>
        </div>
      </div>

      <div className="flex-1 grid lg:grid-cols-2 min-h-0">
        <div className="border-r p-6 space-y-4 overflow-y-auto">
          <PostDcProposalWidget callId={callId} />
          <div>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Sections
            </h2>
            <ul className="space-y-2">
              {draft.sections.map((s) => (
                <SectionRow key={s.id} section={s} onToggle={() => toggleSection(s.id)} />
              ))}
            </ul>
          </div>
          {draft.aiSuggestions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2">Suggested assets</h2>
              <ul className="space-y-2">
                {draft.aiSuggestions.map((a) => {
                  const selected = draft.selectedAssets.some((s) => s.assetId === a.assetId);
                  return (
                    <li key={a.assetId} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground truncate">{a.title}</span>
                      <Button
                        variant={selected ? "secondary" : "outline"}
                        size="sm"
                        className="h-7 shrink-0"
                        onClick={() => {
                          const selectedAssets = selected
                            ? draft.selectedAssets.filter((s) => s.assetId !== a.assetId)
                            : [
                                ...draft.selectedAssets,
                                {
                                  assetId: a.assetId,
                                  title: a.title,
                                  displayMode: "embed" as const,
                                },
                              ];
                          saveDraft({ ...draft, selectedAssets });
                        }}
                      >
                        {selected ? "Remove" : "Add"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {proposal && (
            <div className="rounded-md border px-3 py-2 text-xs">
              <p className="font-medium">Proposal attached</p>
              <p className="text-muted-foreground mt-1">{proposal.title}</p>
            </div>
          )}
        </div>
        <div className="overflow-y-auto bg-muted/20 p-4">
          <p className="text-xs text-muted-foreground mb-2">Preview as customer</p>
          <ClpPublicView page={draft} proposal={proposal ?? null} preview />
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
                    setDraft(p);
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

function SectionRow({ section, onToggle }: { section: ClpSection; onToggle: () => void }) {
  return (
    <li className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
      <span>{section.title ?? section.type}</span>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onToggle}>
        {section.visible !== false ? "Hide" : "Show"}
      </Button>
    </li>
  );
}
