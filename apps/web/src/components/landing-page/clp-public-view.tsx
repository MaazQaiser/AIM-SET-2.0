"use client";

import { KbFileTypeIcon } from "@/components/knowledge/kb-file-type-icon";
import { briefBodyClass, briefBodyForegroundClass } from "@/components/pre-call/brief-detail-card";
import { cn } from "@/lib/cn";
import { type KbFileFormat, resolveKbFileFormat } from "@/lib/kb/file-format";
import { isCompanyPlaybookLandingAsset } from "@/lib/landing-page/clp-editor-utils";
import type {
  ClpAssetRef,
  ClpComment,
  ClpProposal,
  ClpSection,
  CustomerLandingPage,
} from "@dc-copilot/types";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import { Download, Eye, FileText } from "lucide-react";
import { useState } from "react";

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
      <div className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <header className="px-6 py-8">
          <p className="type-caption text-muted-foreground">Lead hub</p>
          <h1 className="type-page-title mt-1">{branding.accountName}</h1>
          {branding.leadName && (
            <p className="text-muted-foreground mt-1">Prepared for {branding.leadName}</p>
          )}
        </header>

        <nav className="flex gap-4 overflow-x-auto border-t px-6 py-2 type-body">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-muted-foreground hover:text-foreground whitespace-nowrap"
            >
              {sectionTitle(s)}
            </a>
          ))}
          {proposal && (
            <a href="#proposal" className="text-muted-foreground hover:text-foreground">
              Proposal
            </a>
          )}
        </nav>
      </div>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        {sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-20">
            {section.type !== "hero" && (
              <div className="flex items-start justify-between gap-2">
                <h2 className="type-section-title">{sectionTitle(section)}</h2>
                {!preview && page.settings?.allowComments !== false && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="type-label h-7"
                    onClick={() =>
                      setCommentSection(commentSection === section.id ? null : section.id)
                    }
                  >
                    Comment
                  </Button>
                )}
              </div>
            )}
            {renderSection(section, page, preview, onDocumentOpen)}
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
                <div key={c.id} className="mt-2 type-body rounded-md border bg-muted/30 px-3 py-2">
                  <span className="font-medium">{c.authorName}</span>: {c.body}
                </div>
              ))}
          </section>
        ))}

        {proposal && (
          <section id="proposal" className="scroll-mt-20" onMouseEnter={() => onProposalOpen?.()}>
            <h2 className="type-section-title mb-4">{proposal.title}</h2>
            <div
              className="prose prose-sm max-w-none rounded-lg border bg-card p-6"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: CLP proposal HTML is generated server-side and stored as the proposal body.
              dangerouslySetInnerHTML={{ __html: proposal.html }}
            />
          </section>
        )}

        {branding.aeName && !sections.some((s) => s.type === "ae_contact") && (
          <section className="rounded-lg border bg-muted/20 p-4 type-body">
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
              <div className="px-3 py-2 border-b font-medium type-body flex justify-between">
                Chat with {branding.aeName ?? "your team"}
                <button
                  type="button"
                  className="text-muted-foreground"
                  onClick={() => setChatOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 type-body">
                {chatMessages.map((m) => (
                  <div
                    key={`${m.authorType}-${m.authorName}-${m.body}`}
                    className={cn(
                      "rounded-md px-2 py-1",
                      m.authorType === "visitor" ? "bg-primary/10 ml-4" : "bg-muted mr-4"
                    )}
                  >
                    <span className="type-label">{m.authorName}</span>
                    <p>{m.body}</p>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t flex gap-2">
                <Input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Message…"
                  className="h-8 type-body"
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
  const blockedAssetIds = new Set(
    [...(page.selectedAssets ?? []), ...(page.aiSuggestions ?? [])]
      .filter((asset) => isCompanyPlaybookLandingAsset(asset))
      .map((asset) => asset.assetId)
  );
  const ids = section.assetIds?.length
    ? section.assetIds
    : section.assetId
      ? [section.assetId]
      : [];
  return ids
    .filter((id) => !blockedAssetIds.has(id))
    .map((id) => {
      const fromSelected = page.selectedAssets.find((a) => a.assetId === id);
      return fromSelected ?? { assetId: id, title: "Document", displayMode: "embed" as const };
    })
    .filter((ref) => !isCompanyPlaybookLandingAsset(ref));
}

function renderSection(
  section: ClpSection,
  page: CustomerLandingPage,
  preview: boolean,
  onDocumentOpen?: (assetId: string) => void
) {
  if (section.type === "hero") {
    return (
      <div className="mt-2 space-y-2">
        {section.headline && (
          <p className="type-screen-title text-foreground leading-snug">{section.headline}</p>
        )}
        {section.subhead && <p className="type-body text-muted-foreground">{section.subhead}</p>}
      </div>
    );
  }

  if (section.type === "ae_contact") {
    const { branding } = page;
    return (
      <div className="mt-3 rounded-lg border bg-muted/20 p-4 type-body">
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
        {section.bullets.map((b) => (
          <li key={b} className="break-words">
            {b}
          </li>
        ))}
      </ul>
    );
  }

  const assetRefs = assetRefsForSection(section, page);
  if (assetRefs.length > 0) {
    return (
      <div className="mt-5 space-y-4">
        {section.caption && <p className="type-body text-muted-foreground">{section.caption}</p>}
        <ul className="grid gap-4 md:grid-cols-2">
          {assetRefs.map((ref) => (
            <SharedResourceCard
              key={ref.assetId}
              page={page}
              asset={ref}
              preview={preview}
              onDocumentOpen={onDocumentOpen}
            />
          ))}
        </ul>
      </div>
    );
  }

  if (section.links?.length) {
    return (
      <ul className="mt-3 space-y-1">
        {section.links.map((l) => (
          <li key={`${l.label}-${l.url}`}>
            <a
              href={l.url}
              className="type-body text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (section.subhead) {
    return <p className="mt-2 type-body text-muted-foreground">{section.subhead}</p>;
  }

  return null;
}

function publicAssetBasePath(page: CustomerLandingPage, assetId: string, preview: boolean) {
  if (preview || !page.shareToken) {
    return `/api/kb/assets/${encodeURIComponent(assetId)}`;
  }
  return `/api/public/clp/${encodeURIComponent(page.shareToken)}/assets/${encodeURIComponent(
    assetId
  )}`;
}

function publicAssetUrls(page: CustomerLandingPage, asset: ClpAssetRef, preview: boolean) {
  const base = publicAssetBasePath(page, asset.assetId, preview);
  return {
    file: asset.downloadUrl && preview ? asset.downloadUrl : `${base}/file`,
    preview: asset.previewUrl && preview ? asset.previewUrl : `${base}/preview`,
    slide: `${base}/preview/slides/1`,
  };
}

function assetFileName(asset: ClpAssetRef) {
  return asset.fileName ?? asset.title;
}

function isImageFormat(format: KbFileFormat) {
  return format === "png" || format === "jpg" || format === "jpeg" || format === "image";
}

function SharedResourceCard({
  page,
  asset,
  preview,
  onDocumentOpen,
}: {
  page: CustomerLandingPage;
  asset: ClpAssetRef;
  preview: boolean;
  onDocumentOpen?: (assetId: string) => void;
}) {
  const fileName = assetFileName(asset);
  const formatMeta = resolveKbFileFormat(fileName, asset.mimeType);
  const urls = publicAssetUrls(page, asset, preview);
  const previewHref = isImageFormat(formatMeta.format) ? urls.file : urls.preview;

  return (
    <li className="group overflow-hidden rounded-2xl border border-border bg-card shadow-soft-xs transition-colors hover:border-foreground/20">
      <a
        href={previewHref}
        target="_blank"
        rel="noopener noreferrer"
        className="block"
        onClick={() => onDocumentOpen?.(asset.assetId)}
        aria-label={`Preview ${asset.title}`}
      >
        <AssetThumbnail asset={asset} urls={urls} format={formatMeta.format} />
      </a>

      <div className="space-y-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <KbFileTypeIcon fileName={fileName} mimeType={asset.mimeType} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate type-panel-title text-foreground">{asset.title}</p>
            <p className="mt-0.5 truncate type-caption text-muted-foreground">
              {formatMeta.label}
              {asset.previewSlideCount ? ` · ${asset.previewSlideCount} slides` : ""}
            </p>
          </div>
        </div>

        {asset.caption ? (
          <p className="line-clamp-2 type-caption leading-relaxed text-muted-foreground">
            {asset.caption}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" className="h-8 rounded-full">
            <a
              href={previewHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onDocumentOpen?.(asset.assetId)}
            >
              <Eye className="h-3.5 w-3.5" />
              Preview
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 rounded-full">
            <a href={urls.file} download={fileName} aria-label={`Download ${asset.title}`}>
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </li>
  );
}

function AssetThumbnail({
  asset,
  urls,
  format,
}: {
  asset: ClpAssetRef;
  urls: { file: string; preview: string; slide: string };
  format: KbFileFormat;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = isImageFormat(format) ? urls.file : urls.slide;
  const showPdfFrame = !imageFailed && (format === "pdf" || format === "docx");

  return (
    <div className="relative aspect-[16/10] overflow-hidden border-b border-border bg-muted/30">
      {!imageFailed && !showPdfFrame ? (
        <img
          src={imageSrc}
          alt={`${asset.title} preview`}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onError={() => setImageFailed(true)}
        />
      ) : showPdfFrame ? (
        <iframe
          src={`${urls.preview}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
          title={`${asset.title} preview`}
          className="h-[135%] w-full origin-top scale-[0.9] border-0 bg-card"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/70 via-card to-muted/40 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-soft-xs">
            <FileText className="h-8 w-8" />
          </div>
          <p className="type-caption font-medium">Preview available on open</p>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background/80 to-transparent" />
    </div>
  );
}
