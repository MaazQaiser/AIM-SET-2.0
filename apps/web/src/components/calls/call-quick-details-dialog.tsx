"use client";

import type { ElementType, ReactNode } from "react";
import {
  Building2,
  ExternalLink,
  Globe,
  Linkedin,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dc-copilot/ui/components/dialog";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { companyRatingForCall, formatCompanyRating } from "@/lib/dc-notes/icp-rating";
import type { Call } from "@/types";

function leadName(call: Call): string {
  return call.leadName?.trim() || "Buyer";
}

function slugifyLinkPart(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function compactDomain(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

function absoluteUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function websiteUrl(accountName: string, website?: string): string {
  const clean = website?.trim();
  if (clean) return absoluteUrl(clean);
  return `https://www.${slugifyLinkPart(accountName, "company").replace(/-/g, "")}.com`;
}

function detailsLinks({
  call,
  personLinkedInUrl,
  companyLinkedInUrl,
}: {
  call: Call;
  personLinkedInUrl?: string;
  companyLinkedInUrl?: string;
}) {
  const companySlug = slugifyLinkPart(call.accountName, "company");
  const personSlug = slugifyLinkPart(leadName(call), "profile");
  const website = websiteUrl(call.accountName, call.website);

  return {
    personLinkedIn: personLinkedInUrl?.trim()
      ? absoluteUrl(personLinkedInUrl.trim())
      : `https://www.linkedin.com/in/${personSlug}`,
    companyLinkedIn: companyLinkedInUrl?.trim()
      ? absoluteUrl(companyLinkedInUrl.trim())
      : `https://www.linkedin.com/company/${companySlug}`,
    website,
  };
}

function DetailLink({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: ElementType;
  label: string;
  value: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex min-w-0 items-center gap-3 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted/60"
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block type-caption text-muted-foreground">{label}</span>
        <span className="block truncate type-body-sm font-medium text-foreground">
          {value}
        </span>
      </span>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function CallQuickDetailsDialog({
  call,
  children,
  personLinkedInUrl,
  companyLinkedInUrl,
  prepLabel,
}: {
  call: Call;
  children: ReactNode;
  personLinkedInUrl?: string;
  companyLinkedInUrl?: string;
  prepLabel?: string;
}) {
  const links = detailsLinks({ call, personLinkedInUrl, companyLinkedInUrl });
  const lead = leadName(call);
  const websiteLabel = compactDomain(links.website);
  const resolvedPrepLabel =
    prepLabel ?? (call.briefReady ? "Brief ready" : "Brief pending");

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-8">{call.accountName}</DialogTitle>
          <DialogDescription>
            {lead}
            {call.leadTitle ? ` · ${call.leadTitle}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <ParticipantAvatar
              name={lead}
              kind="external"
              size="lg"
              title={lead}
            />
            <div className="min-w-0">
              <p className="truncate type-panel-title text-foreground">{lead}</p>
              <p className="truncate type-caption text-muted-foreground">
                {call.leadTitle || "Buyer"} at {call.accountName}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border py-3">
            <div>
              <p className="type-caption text-muted-foreground">Agent rating</p>
              <p className="type-body-sm font-medium text-foreground">
                {formatCompanyRating(companyRatingForCall(call))}
              </p>
            </div>
            <div>
              <p className="type-caption text-muted-foreground">Industry</p>
              <p className="truncate type-body-sm font-medium text-foreground">
                {call.industry || "Not listed"}
              </p>
            </div>
            <div>
              <p className="type-caption text-muted-foreground">Stage</p>
              <p className="truncate type-body-sm font-medium text-foreground">
                {call.dealStage || "Open"}
              </p>
            </div>
            <div>
              <p className="type-caption text-muted-foreground">Prep</p>
              <p className="truncate type-body-sm font-medium text-foreground">
                {resolvedPrepLabel}
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <DetailLink
              href={links.personLinkedIn}
              icon={Linkedin}
              label="Client LinkedIn"
              value={lead}
            />
            <DetailLink
              href={links.companyLinkedIn}
              icon={Building2}
              label="Company LinkedIn"
              value={call.accountName}
            />
            <DetailLink
              href={links.website}
              icon={Globe}
              label="Website"
              value={websiteLabel}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
