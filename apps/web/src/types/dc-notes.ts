/** Exact CSV column headers from pre_dc_notes_data.csv */
export const PRE_DC_HEADERS = {
  companyName: "Company Name-PreDC",
  companyTypeIcp: "Company Type ICP - PreDC",
  annualRevenue: "Annual Revenue - PreDC",
  employeeCount: "No. of Employees - PreDC",
  industry: "Industry - PreDC",
  companyLinkedIn: "Company LinkedIn-PreDC",
  companyDescription: "Company Description",
  website: "Website-PreDC",
  companyStagePreDc: "Company Stage-PreDC",
  companyStage: "Company Stage",
  icpBucket: "ICP Bucket",
  needPreDc: "Need-PreDC",
  campaignService: "Campaign Service - PreDC",
  discoveryCallTimePkt: "Discovery Call Time (PKT)",
  discoveryCallDatePkt: "Discovery Call Date (PKT)",
  prospectPersona: "Prospect's Persona",
  personLinkedIn: "Person LinkedIn-PreDC",
  leadName: "Lead Name-PreDC",
  technicalResources: "Do they have any technical resources?",
  technicalResourcesLocation: "Location of technical resources",
  techJobOpenings: "Job openings for tech positions",
  outsourcing: "Are they outsourcing? if yes, to whom?",
  techStacks: "What tech stacks are they using",
  saasPlatforms: "Are they using any SaaS platforms",
  otherInformation: "Other Information",
  fundingStage: "If its a startup, what Stage of Funding?",
  fundingAmount: "If its startup, funding amount received?",
  intersectionAreas: "Intersection areas b/w tkxel & company",
  describedNeeds: "Have they described their needs",
  technicalBackground: "Background is technical/non-technical?",
  executivesLocation: "Where are their executives located?",
  relevanceToTkxel: "What is their relevance to Tkxel?",
} as const;

/** Exact CSV column headers from post_dc_notes_data.csv */
export const POST_DC_HEADERS = {
  leadStage: "Lead Stage",
  reasonNotFit: "Reason Not A Fit - Post-DC",
  bottomLineContext: "Bottom Line Context",
  engagementModel: "Engagement Model",
  salesStrategy: "Sales Strategy",
  additionalInfo: "Additional Info",
  attendees: "Attendees",
  icpBucketCorrect: "Was Pre DC ICP bucket correct",
  budget: "Budget",
  authority: "Authority",
  need: "Need",
  timeline: "Timeline",
  accountsAnnualPotential: "Accounts Annual Potential",
  serviceLine: "Service Line",
} as const;

export type DcCsvKind = "pre-dc" | "post-dc" | "unknown";

export interface PreDCRecord {
  id: string;
  fields: Record<string, string>;
}

export interface PostDCRecord {
  id: string;
  fields: Record<string, string>;
  matchedCallId?: string;
}

export function preDcField(record: PreDCRecord, key: keyof typeof PRE_DC_HEADERS): string {
  return record.fields[PRE_DC_HEADERS[key]]?.trim() ?? "";
}

export function postDcField(record: PostDCRecord, key: keyof typeof POST_DC_HEADERS): string {
  return record.fields[POST_DC_HEADERS[key]]?.trim() ?? "";
}
