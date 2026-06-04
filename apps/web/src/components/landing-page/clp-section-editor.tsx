"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@dc-copilot/ui/components/button";
import { Input } from "@dc-copilot/ui/components/input";
import { Label } from "@dc-copilot/ui/components/label";
import { Textarea } from "@dc-copilot/ui/components/textarea";
import {
  CLP_SECTION_TYPE_OPTIONS,
  bulletsToText,
  createClpSection,
  linksToText,
  sectionTypeLabel,
  textToBullets,
  textToLinks,
} from "@/lib/landing-page/clp-editor-utils";
import { cn } from "@/lib/cn";
import type { ClpSection, ClpSectionType, CustomerLandingPage } from "@dc-copilot/types";

interface ClpSectionEditorProps {
  draft: CustomerLandingPage;
  onChange: (page: CustomerLandingPage) => void;
}

export function ClpSectionEditor({ draft, onChange }: ClpSectionEditorProps) {
  const [addType, setAddType] = useState<ClpSectionType>("summary");
  const [expandedId, setExpandedId] = useState<string | null>(draft.sections[0]?.id ?? null);

  function updateSections(sections: ClpSection[]) {
    onChange({ ...draft, sections });
  }

  function patchSection(id: string, patch: Partial<ClpSection>) {
    updateSections(draft.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeSection(id: string) {
    updateSections(draft.sections.filter((s) => s.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function addSection() {
    const section = createClpSection(addType);
    updateSections([...draft.sections, section]);
    setExpandedId(section.id);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Sections</h2>
        <div className="flex items-center gap-1.5">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as ClpSectionType)}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            aria-label="Section type to add"
          >
            {CLP_SECTION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            Add
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {draft.sections.map((section, index) => (
          <li key={section.id} className="rounded-lg border bg-card overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                onClick={() => setExpandedId(expandedId === section.id ? null : section.id)}
              >
                <span className="text-[10px] tabular-nums text-muted-foreground w-4">{index + 1}</span>
                <span className="font-medium truncate">
                  {section.title ?? section.headline ?? sectionTypeLabel(section.type)}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {section.type.replace(/_/g, " ")}
                </span>
                {expandedId === section.id ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => patchSection(section.id, { visible: section.visible === false })}
              >
                {section.visible !== false ? "Hide" : "Show"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete section"
                onClick={() => removeSection(section.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>

            {expandedId === section.id && (
              <div className="border-t px-3 py-3 space-y-3 bg-muted/10">
                <SectionFields section={section} onPatch={(patch) => patchSection(section.id, patch)} />
                {section.type === "company_deck" && (
                  <CompanyDeckAssetPicker
                    draft={draft}
                    section={section}
                    onPatch={(patch) => patchSection(section.id, patch)}
                  />
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SectionFields({
  section,
  onPatch,
}: {
  section: ClpSection;
  onPatch: (patch: Partial<ClpSection>) => void;
}) {
  if (section.type === "hero") {
    return (
      <>
        <Field label="Headline">
          <Input
            value={section.headline ?? ""}
            onChange={(e) => onPatch({ headline: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Subhead">
          <Textarea
            value={section.subhead ?? ""}
            onChange={(e) => onPatch({ subhead: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </Field>
      </>
    );
  }

  if (section.type === "summary" || section.type === "next_steps" || section.type === "testimonials") {
    return (
      <>
        <Field label="Section title">
          <Input
            value={section.title ?? ""}
            onChange={(e) => onPatch({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label={section.type === "testimonials" ? "Quotes (one per line)" : "Bullets (one per line)"}>
          <Textarea
            value={bulletsToText(section.bullets)}
            onChange={(e) => onPatch({ bullets: textToBullets(e.target.value) })}
            rows={5}
            className="text-sm font-mono"
          />
        </Field>
      </>
    );
  }

  if (section.type === "asset") {
    return (
      <>
        <Field label="Section title">
          <Input
            value={section.title ?? ""}
            onChange={(e) => onPatch({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Caption (optional)">
          <Textarea
            value={section.caption ?? ""}
            onChange={(e) => onPatch({ caption: e.target.value })}
            rows={2}
            className="text-sm"
          />
        </Field>
        <p className="text-[11px] text-muted-foreground">
          Attach files from the Knowledge base assets panel below.
        </p>
      </>
    );
  }

  if (section.type === "company_deck") {
    return (
      <Field label="Section title">
        <Input
          value={section.title ?? ""}
          onChange={(e) => onPatch({ title: e.target.value })}
          className="h-8 text-sm"
        />
      </Field>
    );
  }

  if (section.type === "quick_links") {
    return (
      <>
        <Field label="Section title">
          <Input
            value={section.title ?? ""}
            onChange={(e) => onPatch({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </Field>
        <Field label="Links (label|url per line)">
          <Textarea
            value={linksToText(section.links)}
            onChange={(e) => onPatch({ links: textToLinks(e.target.value) })}
            rows={4}
            className="text-sm font-mono"
            placeholder={"Schedule call|https://…\nProduct tour|https://…"}
          />
        </Field>
      </>
    );
  }

  if (section.type === "ae_contact") {
    return (
      <Field label="Section title">
        <Input
          value={section.title ?? ""}
          onChange={(e) => onPatch({ title: e.target.value })}
          className="h-8 text-sm"
        />
      </Field>
    );
  }

  return (
    <Field label="Section title">
      <Input
        value={section.title ?? ""}
        onChange={(e) => onPatch({ title: e.target.value })}
        className="h-8 text-sm"
      />
    </Field>
  );
}

function CompanyDeckAssetPicker({
  draft,
  section,
  onPatch,
}: {
  draft: CustomerLandingPage;
  section: ClpSection;
  onPatch: (patch: Partial<ClpSection>) => void;
}) {
  const options = [
    ...draft.selectedAssets,
    ...draft.aiSuggestions
      .filter((s) => !draft.selectedAssets.some((a) => a.assetId === s.assetId))
      .map((s) => ({ assetId: s.assetId, title: s.title })),
  ];

  return (
    <Field label="Deck asset">
      <select
        value={section.assetId ?? ""}
        onChange={(e) => onPatch({ assetId: e.target.value || undefined })}
        className={cn("h-8 w-full rounded-md border border-border bg-background px-2 text-sm")}
      >
        <option value="">Select asset…</option>
        {options.map((o) => (
          <option key={o.assetId} value={o.assetId}>
            {o.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
