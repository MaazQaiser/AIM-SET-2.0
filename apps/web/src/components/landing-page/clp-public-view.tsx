"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import type { ClpAssetRef, ClpComment, ClpProposal, ClpSection, CustomerLandingPage } from "@dc-copilot/types";
import { cn } from "@/lib/cn";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { briefBodyClass, briefBodyForegroundClass } from "@/components/pre-call/brief-detail-card";

interface ClpPublicViewProps {
  page: CustomerLandingPage;
  proposal?: ClpProposal | null;
  comments?: ClpComment[];
  preview?: boolean;
  /** When false, preview fills its container (e.g. fullscreen dialog) without inline chrome. */
  embedded?: boolean;
  onDocumentOpen?: (assetId: string) => void;
  onProposalOpen?: () => void;
  onSendChat?: (body: string) => void;
  onAddComment?: (sectionId: string, body: string) => void;
  chatMessages?: { authorName: string; body: string; authorType: string }[];
}

export function ClpPublicView({
  page,
  proposal,
  comments = [],
  preview = false,
  embedded = true,
  onDocumentOpen,
  onProposalOpen,
  onSendChat,
  onAddComment,
  chatMessages = [],
}: ClpPublicViewProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatText, setChatText] = useState("");
  const [commentSection, setCommentSection] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const branding = page.branding;
  const sections = (page.sections ?? []).filter((s) => s.visible !== false);

  return (
    <div className={cn("min-h-screen", preview && embedded && "rounded-xl border")}>
      <header className="border-b bg-card px-6 py-8">
        <p className="text-xs text-muted-foreground">Lead hub</p>
        <h1 className="text-2xl font-semibold mt-1">{branding.accountName}</h1>
        {branding.leadName && (
          <p className="text-muted-foreground mt-1">Prepared for {branding.leadName}</p>
        )}
      </header>

      <nav className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur px-6 py-2 flex gap-4 text-sm overflow-x-auto">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-muted-foreground hover:text-foreground whitespace-nowrap">
            {sectionTitle(s)}
          </a>
        ))}
        {proposal && (
          <a href="#proposal" className="text-muted-foreground hover:text-foreground" onClick={() => onProposalOpen?.()}>
            Proposal
          </a>
        )}
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            {section.type !== "hero" && (
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold">{sectionTitle(section)}</h2>
                {!preview && page.settings?.allowComments !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setCommentSection(commentSection === section.id ? null : section.id)}
                  >
                    Comment
                  </Button>
                )}
              </div>
            )}
            {renderSection(section, page, onDocumentOpen)}
            {commentSection === section.id && (
              <div className="mt-3 space-y-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Leave a comment…"
                  rows={2}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (commentText.trim()) {
                      onAddComment?.(section.id, commentText.trim());
                      setCommentText("");
                      setCommentSection(null);
                    }
                  }}
                >
                  Post comment
                </Button>
              </div>
            )}
            {comments
              .filter((c) => c.sectionId === section.id)
              .map((c) => (
                <div key={c.id} className="mt-2 text-sm rounded-md border bg-muted/30 px-3 py-2">
                  <span className="font-medium">{c.authorName}</span>: {c.body}
                </div>
              ))}
          </section>
        ))}

        {proposal && (
          <section id="proposal" className="scroll-mt-20" onMouseEnter={() => onProposalOpen?.()}>
            <h2 className="text-lg font-semibold mb-4">{proposal.title}</h2>
            <div
              className="prose prose-sm max-w-none rounded-lg border bg-card p-6"
              dangerouslySetInnerHTML={{ __html: proposal.html }}
            />
          </section>
        )}

        {branding.aeName && !sections.some((s) => s.type === "ae_contact") && (
          <section className="rounded-lg border bg-muted/20 p-4 text-sm">
            <p className="font-medium">Your account team</p>
            <p>{branding.aeName}</p>
            {branding.aeEmail && <p className="text-muted-foreground">{branding.aeEmail}</p>}
          </section>
        )}
      </main>

      {!preview && page.settings?.allowChat !== false && (
        <div className="fixed bottom-6 right-6 z-20">
          {chatOpen ? (
            <div className="w-80 rounded-xl border bg-card shadow-lg flex flex-col max-h-96">
              <div className="px-3 py-2 border-b font-medium text-sm flex justify-between">
                Chat with {branding.aeName ?? "your team"}
                <button type="button" className="text-muted-foreground" onClick={() => setChatOpen(false)}>
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
                {chatMessages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-md px-2 py-1",
                      m.authorType === "visitor" ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                    )}
                  >
                    <span className="text-xs font-medium">{m.authorName}</span>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t flex gap-2">
                <Input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message…"
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (chatText.trim()) {
                      onSendChat?.(chatText.trim());
                      setChatText("");
                    }
                  }}
                >
                  Send
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setChatOpen(true)}>Chat with us</Button>
          )}
        </div>
      )}
    </div>
  );
}

function sectionTitle(s: ClpSection): string {
  if (s.type === "hero") return s.headline ?? "Overview";
  return s.title ?? s.type.replace(/_/g, " ");
}

function assetRefsForSection(section: ClpSection, page: CustomerLandingPage): ClpAssetRef[] {
  const ids = section.assetIds?.length
    ? section.assetIds
    : section.assetId
      ? [section.assetId]
      : [];
  return ids.map((id) => {
    const fromSelected = page.selectedAssets.find((a) => a.assetId === id);
    return fromSelected ?? { assetId: id, title: "Document", displayMode: "embed" as const };
  });
}

function renderSection(
  section: ClpSection,
  page: CustomerLandingPage,
  onDocumentOpen?: (assetId: string) => void
) {
  if (section.type === "hero") {
    return (
      <div className="mt-2 space-y-2">
        {section.headline && (
          <p className="text-xl font-semibold text-foreground leading-snug">{section.headline}</p>
        )}
        {section.subhead && <p className="text-sm text-muted-foreground">{section.subhead}</p>}
      </div>
    );
  }

  if (section.type === "ae_contact") {
    const { branding } = page;
    return (
      <div className="mt-3 rounded-lg border bg-muted/20 p-4 text-sm">
        {branding.aeName && <p className="font-medium">{branding.aeName}</p>}
        {branding.aeEmail && <p className="text-muted-foreground">{branding.aeEmail}</p>}
      </div>
    );
  }

  if (section.bullets?.length) {
    const isSummary = section.type === "summary";
    return (
      <ul
        className={cn(
          "mt-3 list-disc pl-5 space-y-2",
          isSummary ? briefBodyForegroundClass : cn(briefBodyClass, "text-muted-foreground")
        )}
      >
        {section.bullets.map((b, i) => (
          <li key={i} className="break-words">
            {b}
          </li>
        ))}
      </ul>
    );
  }

  const assetRefs = assetRefsForSection(section, page);
  if (assetRefs.length > 0) {
    return (
      <div className="mt-3 space-y-2">
        {section.caption && (
          <p className="text-sm text-muted-foreground">{section.caption}</p>
        )}
        <ul className="space-y-2">
          {assetRefs.map((ref) => (
            <li
              key={ref.assetId}
              className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
            >
              <KbFileTypeIcon fileName={ref.title} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{ref.title}</span>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="h-8 w-8"
                  aria-label={`Preview ${ref.title}`}
                  onClick={() => onDocumentOpen?.(ref.assetId)}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button asChild variant="ghost" size="icon-sm" className="h-8 w-8">
                  <a
                    href={`/api/kb/assets/${ref.assetId}/file`}
                    download
                    aria-label={`Download ${ref.title}`}
                  >
                    <Download className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.links?.length) {
    return (
      <ul className="mt-3 space-y-1">
        {section.links.map((l, i) => (
          <li key={i}>
            <a href={l.url} className="text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (section.subhead) {
    return <p className="mt-2 text-sm text-muted-foreground">{section.subhead}</p>;
  }

  return null;
}
