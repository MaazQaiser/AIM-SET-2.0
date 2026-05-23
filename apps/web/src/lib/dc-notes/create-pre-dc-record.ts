import { PRE_DC_HEADERS, type PreDCRecord } from "@/types/dc-notes";

export interface CreatePreDcRecordOptions {
  companyName?: string;
  leadName?: string;
  discoveryCallDatePkt?: string;
  discoveryCallTimePkt?: string;
}

/** Default discovery date for new leads (today, YYYY-MM-DD). */
export function defaultDiscoveryDatePkt(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function newManualPreDcId(): string {
  return `pre-manual-${crypto.randomUUID()}`;
}

function emptyFields(): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const header of Object.values(PRE_DC_HEADERS)) {
    fields[header] = "";
  }
  return fields;
}

/** Build an empty Pre-DC row with every CSV column present for manual entry. */
export function createEmptyPreDcRecord(options: CreatePreDcRecordOptions = {}): PreDCRecord {
  const fields = emptyFields();
  if (options.companyName) {
    fields[PRE_DC_HEADERS.companyName] = options.companyName.trim();
  }
  if (options.leadName) {
    fields[PRE_DC_HEADERS.leadName] = options.leadName.trim();
  }
  if (options.discoveryCallDatePkt) {
    fields[PRE_DC_HEADERS.discoveryCallDatePkt] = options.discoveryCallDatePkt.trim();
  }
  if (options.discoveryCallTimePkt) {
    fields[PRE_DC_HEADERS.discoveryCallTimePkt] = options.discoveryCallTimePkt.trim();
  }
  return { id: newManualPreDcId(), fields };
}

/** Realistic sample row for the Add Pre-DC lead form (editable before save). */
export function createSamplePreDcRecord(): PreDCRecord {
  const fields = emptyFields();
  const sample: Partial<Record<(typeof PRE_DC_HEADERS)[keyof typeof PRE_DC_HEADERS], string>> = {
    [PRE_DC_HEADERS.companyName]: "Frontera Franchise Group",
    [PRE_DC_HEADERS.companyTypeIcp]: "Enterprise franchise / multi-unit retail",
    [PRE_DC_HEADERS.annualRevenue]: "$180M system-wide",
    [PRE_DC_HEADERS.employeeCount]: "2,400 (corporate + franchisees)",
    [PRE_DC_HEADERS.industry]: "Multi-unit franchise · QSR & fast casual",
    [PRE_DC_HEADERS.companyLinkedIn]: "https://www.linkedin.com/company/frontera-franchise-group",
    [PRE_DC_HEADERS.companyDescription]:
      "Frontera operates 140 franchise locations across North America with fragmented ops tooling. COO is driving an AI-native platform initiative to unify franchise execution, compliance, and unit economics.",
    [PRE_DC_HEADERS.website]: "https://fronterafranchise.com",
    [PRE_DC_HEADERS.companyStagePreDc]: "Evaluation",
    [PRE_DC_HEADERS.companyStage]: "Active opportunity",
    [PRE_DC_HEADERS.icpBucket]: "Enterprise franchise ops",
    [PRE_DC_HEADERS.needPreDc]:
      "Unified franchise operations platform with AI orchestration across corporate and franchisee roles",
    [PRE_DC_HEADERS.campaignService]: "Discovery call · franchise ops modernization",
    [PRE_DC_HEADERS.discoveryCallDatePkt]: defaultDiscoveryDatePkt(),
    [PRE_DC_HEADERS.discoveryCallTimePkt]: "10:00 AM",
    [PRE_DC_HEADERS.prospectPersona]: "COO · operational decision-maker",
    [PRE_DC_HEADERS.personLinkedIn]: "https://www.linkedin.com/in/marcus-chen-coo",
    [PRE_DC_HEADERS.leadName]: "Marcus Chen",
    [PRE_DC_HEADERS.technicalResources]: "Yes — internal data engineering team (~12 FTE)",
    [PRE_DC_HEADERS.technicalResourcesLocation]: "Dallas HQ + remote",
    [PRE_DC_HEADERS.techJobOpenings]: "ML engineer, integration architect",
    [PRE_DC_HEADERS.outsourcing]: "Partial — POS integrations via MSP",
    [PRE_DC_HEADERS.techStacks]: "Snowflake, Microsoft Azure, custom POS APIs",
    [PRE_DC_HEADERS.saasPlatforms]: "Salesforce, ServiceNow, franchisee portal (custom)",
    [PRE_DC_HEADERS.otherInformation]:
      "Board review targeted May 2026; pilot regions Texas + Arizona; proposal requested after discovery",
    [PRE_DC_HEADERS.describedNeeds]:
      "Yes — single system of execution across brands; compliance automation and unit-level analytics",
    [PRE_DC_HEADERS.technicalBackground]: "Technical leadership with domain ops focus",
    [PRE_DC_HEADERS.executivesLocation]: "Dallas, TX (HQ)",
    [PRE_DC_HEADERS.relevanceToTkxel]:
      "Strong fit for multi-tenant ops platforms, agent fabric, and franchise rollout programs",
  };
  for (const [header, value] of Object.entries(sample)) {
    if (value) fields[header] = value;
  }
  return { id: newManualPreDcId(), fields };
}

/** Map PreDCRecord field keys to human-readable form labels. */
export const PRE_DC_FIELD_ENTRIES = (
  Object.entries(PRE_DC_HEADERS) as [keyof typeof PRE_DC_HEADERS, string][]
).map(([key, header]) => ({ key, header }));
