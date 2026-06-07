"use client";

import { BriefDetailCard } from "@/components/pre-call/brief-detail-card";
import type { CustomerLandingPage } from "@dc-copilot/types";

interface ClpClientEngagementSettingsProps {
  draft: CustomerLandingPage;
  onChange: (page: CustomerLandingPage) => void;
  disabled?: boolean;
}

export function ClpClientEngagementSettings({
  draft,
  onChange,
  disabled = false,
}: ClpClientEngagementSettingsProps) {
  const settings = draft.settings ?? {};

  function patch(partial: Partial<CustomerLandingPage["settings"]>) {
    onChange({
      ...draft,
      settings: { ...settings, ...partial },
    });
  }

  return (
    <BriefDetailCard title="Client engagement">
      <div className="space-y-3">
      <p className="type-caption text-muted-foreground">
        When launched, clients can chat with you and leave comments on sections.
      </p>
      <label className="flex items-center justify-between gap-3 type-body cursor-pointer">
        <span>Allow live chat</span>
        <input
          type="checkbox"
          checked={settings.allowChat !== false}
          disabled={disabled}
          onChange={(e) => patch({ allowChat: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
      </label>
      <label className="flex items-center justify-between gap-3 type-body cursor-pointer">
        <span>Allow section comments</span>
        <input
          type="checkbox"
          checked={settings.allowComments !== false}
          disabled={disabled}
          onChange={(e) => patch({ allowComments: e.target.checked })}
          className="h-4 w-4 rounded border-border"
        />
      </label>
      </div>
    </BriefDetailCard>
  );
}
