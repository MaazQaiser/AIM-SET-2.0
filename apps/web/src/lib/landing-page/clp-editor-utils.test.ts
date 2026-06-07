import { describe, expect, it } from "vitest";
import type { CustomerLandingPage } from "@dc-copilot/types";
import {
  isCompanyPlaybookLandingAsset,
  syncAssetSections,
  toggleSelectedAsset,
} from "./clp-editor-utils";

function landingPage(overrides: Partial<CustomerLandingPage> = {}): CustomerLandingPage {
  const now = new Date().toISOString();
  return {
    id: "clp-1",
    callId: "call-1",
    ownerUserId: "user-1",
    status: "draft",
    shareToken: "token",
    version: 1,
    branding: { accountName: "Acme" },
    sections: [],
    selectedAssets: [],
    aiSuggestions: [],
    settings: {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("CLP asset filtering", () => {
  it("detects company playbook assets by title or file name", () => {
    expect(
      isCompanyPlaybookLandingAsset({ title: "Tkxel Company Playbook - Official Site Synthesis" })
    ).toBe(true);
    expect(isCompanyPlaybookLandingAsset({ fileName: "company-playbook.docx" })).toBe(true);
    expect(isCompanyPlaybookLandingAsset({ title: "Tkxel company deck" })).toBe(false);
  });

  it("removes company playbook assets from landing-page draft sections and suggestions", () => {
    const synced = syncAssetSections(
      landingPage({
        selectedAssets: [
          { assetId: "asset-playbook", title: "Tkxel Company Playbook - Official Site Synthesis" },
          { assetId: "asset-case-study", title: "Fintech case study" },
        ],
        aiSuggestions: [
          {
            assetId: "asset-playbook",
            title: "Tkxel Company Playbook - Official Site Synthesis",
            reason: "Internal source",
          },
        ],
        sections: [
          {
            id: "shared",
            type: "asset",
            visible: true,
            title: "Shared resources",
            assetIds: ["asset-playbook", "asset-case-study"],
          },
          {
            id: "deck",
            type: "company_deck",
            visible: true,
            title: "Company overview",
            assetId: "asset-playbook",
          },
        ],
      })
    );

    expect(synced.selectedAssets).toEqual([
      { assetId: "asset-case-study", title: "Fintech case study" },
    ]);
    expect(synced.aiSuggestions).toEqual([]);
    expect(synced.sections[0].assetIds).toEqual(["asset-case-study"]);
    expect(synced.sections[1].assetId).toBeUndefined();
  });

  it("does not add a company playbook asset when toggled", () => {
    const synced = toggleSelectedAsset(landingPage(), {
      assetId: "asset-playbook",
      title: "Tkxel Company Playbook - Official Site Synthesis",
    });

    expect(synced.selectedAssets).toEqual([]);
  });
});
