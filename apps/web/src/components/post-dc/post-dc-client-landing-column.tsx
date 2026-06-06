"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  Loader2,
  MessageSquare,
  Rocket,
  Sparkles,
} from "lucide-react";
import { Badge } from "@dc-copilot/ui/components/badge";
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
import { ClpClientEngagementSettings } from "@/components/landing-page/clp-client-engagement-settings";
import { ClpKbAssetsPanel } from "@/components/landing-page/clp-kb-assets-panel";
import { ClpPublicView } from "@/components/landing-page/clp-public-view";
import { ClpSectionEditor } from "@/components/landing-page/clp-section-editor";
import { PostDcClpActivityCard } from "@/components/post-dc/post-dc-clp-activity-card";
import { PostDcClpAnalyticsWidget } from "@/components/post-dc/post-dc-clp-analytics-widget";
import {
  useClpProposal,
  useGenerateLandingPage,
  useLandingPage,
  usePublishLandingPage,
  useUpdateLandingPage,
} from "@/lib/data/clp-hooks";
import { useCall } from "@/lib/data/hooks";
import { copyTextToClipboard } from "@/lib/clipboard";
import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import { syncAssetSections } from "@/lib/landing-page/clp-editor-utils";
import { toast } from "sonner";
import type { CustomerLandingPage } from "@dc-copilot/types";

interface PostDcClientLandingColumnProps {
  callId: string;
}

export function PostDcClientLandingColumn({ callId }: PostDcClientLandingColumnProps) {
  const { data: call } = useCall(callId);
  const { data: page, isLoading, refetch } = useLandingPage(callId);
  const { data: proposal } = useClpProposal(callId);
  const generate = useGenerateLandingPage(callId);
  const update = useUpdateLandingPage(callId);
  const publish = usePublishLandingPage(callId);
  const [draft, setDraft] = useState<CustomerLandingPage | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const autoGenerateAttempted = useRef(false);

  useEffect(() => {
    if (page) setDraft(syncAssetSections(page));
  }, [page]);

  useEffect(() => {
    if (isLoading || page || generate.isPending || autoGenerateAttempted.current) return;
    autoGenerateAttempted.current = true;
    generate.mutate(undefined, {
      onSuccess: (p) => setDraft(syncAssetSections(p)),
      onError: () => toast.error("Could not plan landing page"),
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

  async function copyShareLink() {
    if (!draft?.publicUrl) return;
    const copied = await copyTextToClipboard(draft.publicUrl);
    if (copied) toast.success("Client link copied");
    else toast.error("Click back into the page before copying");
  }

  if (!draft && (isLoading || generate.isPending)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="py-12 text-center text-muted-foreground space-y-3">
        <p>Could not load the client landing page.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              autoGenerateAttempted.current = false;
              generate.mutate(undefined, {
                onSuccess: (p) => setDraft(syncAssetSections(p)),
                onError: () => toast.error("Could not plan landing page"),
              });
            }}
            disabled={generate.isPending}
          >
            Plan with AI
          </Button>
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const isPublished = draft.status === "published";
  const isPlanning = !isPublished || editMode;
  const accountName = call?.accountName ?? draft.branding.accountName;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Globe className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold">Client landing page</h2>
            <Badge
              variant={isPublished ? "success" : "secondary"}
              className="text-[10px] uppercase tracking-wide"
            >
              {isPublished && !editMode ? "Live" : "Planning"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Digital sales room for {accountName} — share the call summary, tkxel deck, and selected
            materials. Clients can chat and comment once launched.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isPlanning ? (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={generate.isPending}
                onClick={() =>
                  generate.mutate(undefined, {
                    onSuccess: (p) => {
                      setDraft(syncAssetSections(p));
                      toast.success("Room refreshed from call data");
                    },
                  })
                }
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Plan with AI
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button size="sm" onClick={() => setPublishOpen(true)}>
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Launch
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyShareLink()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Share link
              </Button>
              {draft.publicUrl && (
                <Button asChild variant="outline" size="sm">
                  <a href={draft.publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open live page
                  </a>
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setEditMode(true)}>
                Modify room
              </Button>
            </>
          )}
        </div>
      </header>

      {isPublished && !editMode && (
        <section className="space-y-4">
          <PostDcClpAnalyticsWidget callId={callId} enabled />
          <RoomPlanChecklist draft={draft} proposalAttached={Boolean(proposal)} published />
        </section>
      )}

      {isPlanning && (
        <div className="min-w-0 space-y-5">
          <RoomPlanChecklist draft={draft} proposalAttached={Boolean(proposal)}>
            <ClpSectionEditor draft={draft} onChange={saveDraft} embedded />
          </RoomPlanChecklist>

          <BriefDetailCard title="Proposal" icon={FileText}>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Attach a formal proposal to the sales room after discovery.
              </p>
              <Badge variant="outline" className="text-[10px]">
                Coming soon
              </Badge>
            </div>
          </BriefDetailCard>

          <ClpKbAssetsPanel
            draft={draft}
            onChange={saveDraft}
            heading="Selected decks & assets"
            description="Choose decks and files the AE wants on the page — including custom decks beyond the tkxel company deck."
          />

          <ClpClientEngagementSettings draft={draft} onChange={saveDraft} />

          {isPublished && editMode && (
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => setEditMode(false)}>
                Done editing
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyShareLink()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy client link
              </Button>
            </div>
          )}
        </div>
      )}

      {isPublished && !editMode && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PostDcClpActivityCard callId={callId} enabled />
          <BriefDetailCard title="Client feedback" icon={MessageSquare}>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {draft.settings?.allowChat !== false && draft.settings?.allowComments !== false
                  ? "Chat and section comments are enabled on the live page."
                  : draft.settings?.allowChat !== false
                    ? "Live chat is enabled on the client page."
                    : draft.settings?.allowComments !== false
                      ? "Section comments are enabled on the client page."
                      : "Enable chat or comments in Modify room to collect client feedback."}
              </p>
              <Link
                href={`/calls/${callId}/landing-page/activity`}
                className="text-xs text-primary hover:underline inline-block"
              >
                View full activity &amp; engagement report
              </Link>
            </div>
          </BriefDetailCard>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="left-0 top-0 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none border-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-3">
            <DialogTitle>Preview as client</DialogTitle>
            <DialogDescription>
              This is how {accountName} will see the sales room.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            <ClpPublicView
              page={draft}
              proposal={proposal ?? null}
              preview
              embedded={false}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch client landing page</DialogTitle>
            <DialogDescription>
              Set a password your client will use to access the sales room. They enter their name
              and email on each visit. After launch, share the link and track opens, deck previews,
              and engagement.
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
                    setEditMode(false);
                    setPassword("");
                    toast.success("Sales room launched — share the link with your client");
                  },
                  onError: () => toast.error("Launch failed"),
                });
              }}
            >
              Launch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RoomPlanChecklist({
  draft,
  proposalAttached,
  published = false,
  children,
}: {
  draft: CustomerLandingPage;
  proposalAttached: boolean;
  published?: boolean;
  children?: ReactNode;
}) {
  const hasSummary = draft.sections.some((s) => s.type === "summary" && s.visible !== false);
  const companyDeck = draft.sections.find((s) => s.type === "company_deck" && s.visible !== false);
  const selectedDeckCount = draft.selectedAssets.length;

  const items = [
    {
      label: "Conversation summary with tkxel",
      ready: hasSummary,
      detail: hasSummary ? "Included from discovery call" : "Add or show summary section",
    },
    {
      label: "tkxel company deck",
      ready: Boolean(companyDeck?.assetId),
      detail: companyDeck?.title ?? "Select company deck in sections",
    },
    {
      label: "AE-selected deck & assets",
      ready: selectedDeckCount > 0,
      detail:
        selectedDeckCount > 0
          ? `${selectedDeckCount} asset${selectedDeckCount === 1 ? "" : "s"} on page`
          : "Pick decks from knowledge base",
    },
    {
      label: "Proposal",
      ready: proposalAttached,
      detail: proposalAttached ? "Draft attached" : "Coming soon",
      comingSoon: !proposalAttached,
    },
  ];

  return (
    <BriefDetailCard title={published ? "Sales room contents" : "Plan your sales room"}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          What your client will see when they open the link.
        </p>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-start justify-between gap-3 rounded-md border border-border/60 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
              </div>
              {item.comingSoon ? (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Coming soon
                </Badge>
              ) : (
                <Badge
                  variant={item.ready ? "success" : "secondary"}
                  className="shrink-0 text-[10px]"
                >
                  {item.ready ? "Ready" : "Pending"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        {children}
      </div>
    </BriefDetailCard>
  );
}
