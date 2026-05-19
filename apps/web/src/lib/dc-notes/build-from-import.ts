import type { Call, BANTStatus } from "@/types";
import type {
  BriefResearchSection,
  CallBrief,
  PostCallReview,
  PostDcBriefPreview,
} from "@/lib/brief-types";
import {
  POST_DC_HEADERS,
  PRE_DC_HEADERS,
  preDcField,
  postDcField,
  type PreDCRecord,
  type PostDCRecord,
} from "@/types/dc-notes";
import {
  isDiscoveryCallUpcoming,
  parseDiscoveryDateTime,
} from "@/lib/dc-notes/parse-discovery";
import { formatCompanyRevenue } from "@/lib/dc-notes/format";

export function slugifyCompany(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return slug ? `call-${slug}` : `call-${Date.now()}`;
}

function icpScoreFromBucket(bucket: string): number {
  const b = bucket.toLowerCase();
  if (b.includes("enterprise") || b.includes("desirable")) return 0.88;
  if (b.includes("sweet spot")) return 0.78;
  if (b.includes("potential")) return 0.62;
  return 0.55;
}

function mapPostDcBant(value: string): BANTStatus {
  const v = value.trim().toLowerCase();
  if (!v || v === "#name?" || v === "n/a") return "unknown";
  if (v === "yes") return "confirmed";
  if (v === "no") return "unknown";
  return "partial";
}

export function buildCallFromPreDc(record: PreDCRecord): Call {
  const companyName = preDcField(record, "companyName");
  const discoveryCallDatePkt = preDcField(record, "discoveryCallDatePkt");
  const discoveryCallTimePkt = preDcField(record, "discoveryCallTimePkt");

  const scheduledAt =
    parseDiscoveryDateTime(discoveryCallDatePkt, discoveryCallTimePkt) ??
    new Date().toISOString();

  const revenueRaw = preDcField(record, "annualRevenue");

  return {
    id: slugifyCompany(companyName),
    accountName: companyName,
    leadName: preDcField(record, "leadName"),
    leadTitle: preDcField(record, "prospectPersona"),
    industry: preDcField(record, "industry"),
    annualRevenueRaw: revenueRaw || undefined,
    annualRevenue: formatCompanyRevenue(revenueRaw),
    employeeCount: preDcField(record, "employeeCount") || undefined,
    icpBucket: preDcField(record, "icpBucket") || undefined,
    website: preDcField(record, "website") || undefined,
    companyTypeIcp: preDcField(record, "companyTypeIcp") || undefined,
    dealStage: preDcField(record, "companyStage") || preDcField(record, "icpBucket"),
    discoveryCallDatePkt: discoveryCallDatePkt || undefined,
    discoveryCallTimePkt: discoveryCallTimePkt || undefined,
    scheduledAt,
    status: isDiscoveryCallUpcoming(scheduledAt) ? "upcoming" : "completed",
    briefReady: true,
    pod: [],
    bant: {
      budget: "unknown",
      authority: "partial",
      need: preDcField(record, "describedNeeds") ? "partial" : "unknown",
      timeline: "unknown",
    },
  };
}

function fieldItem(
  record: PreDCRecord,
  label: string,
  key: keyof typeof PRE_DC_HEADERS
): { label: string; value: string } | null {
  const value = preDcField(record, key);
  return value ? { label, value } : null;
}

function buildExtraCsvFieldsSection(record: PreDCRecord): BriefResearchSection | null {
  const known = new Set<string>(Object.values(PRE_DC_HEADERS));
  const items = Object.entries(record.fields)
    .filter(([key, value]) => value?.trim() && !known.has(key))
    .map(([key, value]) => ({ label: key, value: value.trim() }));
  return items.length > 0 ? { title: "Additional CSV fields", items } : null;
}

export function buildResearchSections(record: PreDCRecord): BriefResearchSection[] {
  const section = (
    title: string,
    items: ({ label: string; value: string } | null)[]
  ): BriefResearchSection | null => {
    const filtered = items.filter(Boolean) as { label: string; value: string }[];
    return filtered.length > 0 ? { title, items: filtered } : null;
  };

  return [
    section("Account & ICP", [
      fieldItem(record, "Company", "companyName"),
      fieldItem(record, "Company type (ICP)", "companyTypeIcp"),
      fieldItem(record, "Annual revenue", "annualRevenue"),
      fieldItem(record, "Employees", "employeeCount"),
      fieldItem(record, "Industry", "industry"),
      fieldItem(record, "Company stage", "companyStage"),
      fieldItem(record, "Stage (Pre-DC)", "companyStagePreDc"),
      fieldItem(record, "ICP bucket", "icpBucket"),
      fieldItem(record, "Need", "needPreDc"),
      fieldItem(record, "Campaign / service", "campaignService"),
    ]),
    section("Discovery call", [
      fieldItem(record, "Date (PKT)", "discoveryCallDatePkt"),
      fieldItem(record, "Time (PKT)", "discoveryCallTimePkt"),
      fieldItem(record, "Lead name", "leadName"),
      fieldItem(record, "Prospect persona", "prospectPersona"),
      fieldItem(record, "Person LinkedIn", "personLinkedIn"),
      fieldItem(record, "Relevance to Tkxel", "relevanceToTkxel"),
    ]),
    section("Company profile", [
      fieldItem(record, "Website", "website"),
      fieldItem(record, "Company LinkedIn", "companyLinkedIn"),
      fieldItem(record, "Description", "companyDescription"),
      fieldItem(record, "Executives location", "executivesLocation"),
    ]),
    section("Technical landscape", [
      fieldItem(record, "Technical resources", "technicalResources"),
      fieldItem(record, "Resource location", "technicalResourcesLocation"),
      fieldItem(record, "Tech job openings", "techJobOpenings"),
      fieldItem(record, "Outsourcing", "outsourcing"),
      fieldItem(record, "Tech stacks", "techStacks"),
      fieldItem(record, "SaaS platforms", "saasPlatforms"),
      fieldItem(record, "Technical background", "technicalBackground"),
    ]),
    section("Funding & strategic fit", [
      fieldItem(record, "Funding stage", "fundingStage"),
      fieldItem(record, "Funding amount", "fundingAmount"),
      fieldItem(record, "Intersection w/ Tkxel", "intersectionAreas"),
      fieldItem(record, "Described needs", "describedNeeds"),
      fieldItem(record, "Other information", "otherInformation"),
    ]),
    buildExtraCsvFieldsSection(record),
  ].filter(Boolean) as BriefResearchSection[];
}

export function buildPostDcResearchSections(record: PostDCRecord): BriefResearchSection[] {
  const section = (
    title: string,
    items: ({ label: string; value: string } | null)[]
  ): BriefResearchSection | null => {
    const filtered = items.filter(Boolean) as { label: string; value: string }[];
    return filtered.length > 0 ? { title, items: filtered } : null;
  };

  const known = new Set<string>(Object.values(POST_DC_HEADERS));
  const extraItems = Object.entries(record.fields)
    .filter(([key, value]) => value?.trim() && !known.has(key))
    .map(([key, value]) => ({ label: key, value: value.trim() }));

  return [
    section("Opportunity", [
      postDcField(record, "leadStage") ? { label: "Lead stage", value: postDcField(record, "leadStage") } : null,
      postDcField(record, "accountsAnnualPotential")
        ? { label: "Annual potential", value: postDcField(record, "accountsAnnualPotential") }
        : null,
      postDcField(record, "serviceLine") ? { label: "Service line", value: postDcField(record, "serviceLine") } : null,
      postDcField(record, "engagementModel")
        ? { label: "Engagement model", value: postDcField(record, "engagementModel") }
        : null,
      postDcField(record, "reasonNotFit")
        ? { label: "Reason not a fit", value: postDcField(record, "reasonNotFit") }
        : null,
    ]),
    section("Context & strategy", [
      postDcField(record, "bottomLineContext")
        ? { label: "Bottom line context", value: postDcField(record, "bottomLineContext") }
        : null,
      postDcField(record, "salesStrategy")
        ? { label: "Sales strategy", value: postDcField(record, "salesStrategy") }
        : null,
      postDcField(record, "additionalInfo")
        ? { label: "Additional info", value: postDcField(record, "additionalInfo") }
        : null,
      postDcField(record, "attendees") ? { label: "Attendees", value: postDcField(record, "attendees") } : null,
    ]),
    section("BANT", [
      postDcField(record, "budget") ? { label: "Budget", value: postDcField(record, "budget") } : null,
      postDcField(record, "authority") ? { label: "Authority", value: postDcField(record, "authority") } : null,
      postDcField(record, "need") ? { label: "Need", value: postDcField(record, "need") } : null,
      postDcField(record, "timeline") ? { label: "Timeline", value: postDcField(record, "timeline") } : null,
      postDcField(record, "icpBucketCorrect")
        ? { label: "Pre-DC ICP correct", value: postDcField(record, "icpBucketCorrect") }
        : null,
    ]),
    extraItems.length > 0 ? { title: "Additional CSV fields", items: extraItems } : null,
  ].filter(Boolean) as BriefResearchSection[];
}

export function buildPostDcBriefPreview(record: PostDCRecord): PostDcBriefPreview {
  return {
    leadStage: postDcField(record, "leadStage"),
    bottomLineContext: postDcField(record, "bottomLineContext"),
    salesStrategy: postDcField(record, "salesStrategy"),
    engagementModel: postDcField(record, "engagementModel"),
    additionalInfo: postDcField(record, "additionalInfo"),
    bant: [
      { label: "Budget", value: postDcField(record, "budget") },
      { label: "Authority", value: postDcField(record, "authority") },
      { label: "Need", value: postDcField(record, "need") },
      { label: "Timeline", value: postDcField(record, "timeline") },
      { label: "ICP bucket correct", value: postDcField(record, "icpBucketCorrect") },
      { label: "Annual potential", value: postDcField(record, "accountsAnnualPotential") },
      { label: "Service line", value: postDcField(record, "serviceLine") },
    ].filter((row) => row.value),
  };
}

export function discoveryQuestionsFromPreDc(record: PreDCRecord): string[] {
  const company = preDcField(record, "companyName");
  const lead = preDcField(record, "leadName");
  const questions: string[] = [];

  if (preDcField(record, "intersectionAreas")) {
    questions.push(
      `How are you currently approaching ${preDcField(record, "intersectionAreas")} at ${company}?`
    );
  }
  if (preDcField(record, "describedNeeds")) {
    questions.push(`You mentioned "${preDcField(record, "describedNeeds").slice(0, 120)}…" — can you expand on priority and timeline?`);
  }
  if (preDcField(record, "techStacks")) {
    questions.push(`Walk me through your stack today (${preDcField(record, "techStacks")}) and where it breaks down.`);
  }
  if (lead) {
    questions.push(`What does success look like for you personally, ${lead}, if we partner on this initiative?`);
  }
  if (preDcField(record, "outsourcing")) {
    questions.push("How do you handle build vs. buy vs. outsource for new technical work?");
  }

  return questions.slice(0, 5);
}

export function buildBriefFromPreDc(record: PreDCRecord, callId: string): CallBrief {
  const companyName = preDcField(record, "companyName");
  const leadName = preDcField(record, "leadName");
  const description = preDcField(record, "companyDescription");
  const intersection = preDcField(record, "intersectionAreas");
  const needs = preDcField(record, "describedNeeds");
  const relevance = preDcField(record, "relevanceToTkxel");
  const other = preDcField(record, "otherInformation");
  const icpBucket = preDcField(record, "icpBucket");

  const summaryParts = [intersection, needs, relevance].filter(Boolean);
  const aiSummary =
    summaryParts.join(" ") ||
    (description.length > 400 ? `${description.slice(0, 400)}…` : description) ||
    `Discovery call prep for ${companyName}.`;

  const pains = [intersection, needs]
    .filter(Boolean)
    .slice(0, 3)
    .map((text, i) => ({ text, confidence: 0.85 - i * 0.08 }));

  return {
    callId,
    accountName: companyName,
    aiSummary,
    opportunityValue: formatCompanyRevenue(preDcField(record, "annualRevenue"))
      ? `${formatCompanyRevenue(preDcField(record, "annualRevenue"))} annual revenue`
      : undefined,
    dealStage: preDcField(record, "companyStage") || icpBucket || "Discovery",
    daysSinceLastContact: 0,
    icpMatch: icpScoreFromBucket(icpBucket),
    icpNote: [preDcField(record, "companyTypeIcp"), icpBucket].filter(Boolean).join(" · "),
    newSignals: [other, preDcField(record, "techJobOpenings")].filter(Boolean),
    clientAttendees: leadName
      ? [
          {
            id: `${callId}-lead`,
            name: leadName,
            title: preDcField(record, "prospectPersona"),
            department: preDcField(record, "industry"),
            influenceLevel: "decision-maker",
            background: [
              preDcField(record, "technicalBackground"),
              preDcField(record, "executivesLocation"),
            ]
              .filter(Boolean)
              .join(" · "),
            priorInteractionNote: needs || undefined,
            linkedinUrl: preDcField(record, "personLinkedIn") || undefined,
          },
        ]
      : [],
    interactionHistory: [],
    pains,
    objections: [],
    deckSlides: [],
    podNotes: [
      ...(needs ? [{ memberName: "SDR / AE", role: "Notes", note: needs }] : []),
      ...(other ? [{ memberName: "Research", role: "Intel", note: other }] : []),
      ...(relevance
        ? [{ memberName: "Account fit", role: "Strategy", note: relevance }]
        : []),
    ],
    researchSections: buildResearchSections(record),
  };
}

export function buildPostReviewFromPostDc(record: PostDCRecord): PostCallReview {
  const bottomLine = postDcField(record, "bottomLineContext");
  const paragraphs = bottomLine
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const leadStage = postDcField(record, "leadStage");
  const potential = postDcField(record, "accountsAnnualPotential");
  const serviceLine = postDcField(record, "serviceLine");

  return {
    headline: [leadStage, potential, serviceLine].filter(Boolean).join(" · ") || "Post-DC summary",
    summary: paragraphs.length > 0 ? paragraphs : [bottomLine || "No summary provided."],
    researchSections: buildPostDcResearchSections(record),
    podScorecard: [
      {
        member: "Pod",
        role: "Pod",
        score: leadStage.toLowerCase() === "opportunity" ? 0.82 : 0.68,
        label: leadStage || "review",
        strengths: postDcField(record, "salesStrategy") || "See sales strategy notes.",
        watch: postDcField(record, "reasonNotFit") || "",
      },
    ],
    learned: [
      { label: "Budget", note: postDcField(record, "budget") || "—" },
      { label: "Authority", note: postDcField(record, "authority") || "—" },
      { label: "Need", note: postDcField(record, "need") || "—" },
      { label: "Timeline", note: postDcField(record, "timeline") || "—" },
      {
        label: "ICP bucket",
        note: postDcField(record, "icpBucketCorrect")
          ? `Pre-DC ICP correct: ${postDcField(record, "icpBucketCorrect")}`
          : "—",
      },
    ],
  };
}

export function buildBantFromPostDc(record: PostDCRecord): Call["bant"] {
  return {
    budget: mapPostDcBant(postDcField(record, "budget")),
    authority: mapPostDcBant(postDcField(record, "authority")),
    need: mapPostDcBant(postDcField(record, "need")),
    timeline: mapPostDcBant(postDcField(record, "timeline")),
  };
}

export function matchPostDcToCall(
  record: PostDCRecord,
  calls: Call[],
  preDcRecords: PreDCRecord[]
): string | undefined {
  const haystack = [
    postDcField(record, "bottomLineContext"),
    postDcField(record, "additionalInfo"),
    postDcField(record, "attendees"),
  ]
    .join(" ")
    .toLowerCase();

  for (const pre of preDcRecords) {
    const company = preDcField(pre, "companyName");
    if (company.length > 3 && haystack.includes(company.toLowerCase())) {
      return slugifyCompany(company);
    }
    const lead = preDcField(pre, "leadName");
    if (lead.length > 3 && haystack.includes(lead.toLowerCase())) {
      return slugifyCompany(preDcField(pre, "companyName"));
    }
  }

  for (const call of calls) {
    if (call.accountName.length > 3 && haystack.includes(call.accountName.toLowerCase())) {
      return call.id;
    }
  }

  return undefined;
}

export function ingestPreDcRecords(records: PreDCRecord[]): {
  calls: Call[];
  briefsByCallId: Record<string, CallBrief>;
} {
  const calls = records.map(buildCallFromPreDc);
  const briefsByCallId: Record<string, CallBrief> = {};
  for (const record of records) {
    const callId = slugifyCompany(preDcField(record, "companyName"));
    briefsByCallId[callId] = buildBriefFromPreDc(record, callId);
  }
  return { calls, briefsByCallId };
}

export function ingestPostDcRecords(
  records: PostDCRecord[],
  calls: Call[],
  preDcRecords: PreDCRecord[]
): {
  postReviewsByCallId: Record<string, PostCallReview>;
  updatedCalls: Call[];
  records: PostDCRecord[];
} {
  const postReviewsByCallId: Record<string, PostCallReview> = {};
  const callById = new Map(calls.map((c) => [c.id, { ...c }]));

  const enriched = records.map((record) => {
    const matchedCallId = matchPostDcToCall(record, calls, preDcRecords);
    const review = buildPostReviewFromPostDc(record);
    if (matchedCallId) {
      postReviewsByCallId[matchedCallId] = review;
      const existing = callById.get(matchedCallId);
      if (existing) {
        callById.set(matchedCallId, {
          ...existing,
          bant: buildBantFromPostDc(record),
          status: "completed",
        });
      }
    }
    return { ...record, matchedCallId };
  });

  return {
    postReviewsByCallId,
    updatedCalls: Array.from(callById.values()),
    records: enriched,
  };
}
