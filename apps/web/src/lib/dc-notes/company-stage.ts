/** Canonical company stages shown in the calls table and call detail. */
export const COMPANY_STAGES = [
  "SMB",
  "Ideation",
  "Startup",
  "Funded Startup",
  "Enterprise",
] as const;

export type CompanyStage = (typeof COMPANY_STAGES)[number];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Prefer explicit Pre-DC "Company Stage" values from CSV / imports. */
function stageFromExplicitField(raw?: string): CompanyStage | null {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return null;

  const exact = COMPANY_STAGES.find((s) => s.toLowerCase() === t);
  if (exact) return exact;

  // Common Pre-DC CSV labels
  if (t === "sme" || t.includes("small and medium")) return "SMB";
  if (t.includes("ideation") || t.includes("evaluation")) return "Ideation";
  if (t.includes("enterprise") || t.includes("enterprice")) return "Enterprise";
  if (
    /series\s*[a-d]/.test(t) ||
    (t.includes("funded") && (t.includes("startup") || t.includes("start-up")))
  ) {
    return "Funded Startup";
  }
  if (
    t === "startup" ||
    t === "start-up" ||
    t.startsWith("startup ") ||
    t.startsWith("start-up ") ||
    t.includes("early startup") ||
    t.includes("early start-up") ||
    t.includes("early stage")
  ) {
    return "Startup";
  }
  if (t === "smb" || t.includes("small business") || t.includes("smb ")) return "SMB";

  return null;
}

function isFundedStartupSignal(fundingStage?: string, fundingAmount?: string): boolean {
  const combined = [fundingStage, fundingAmount].filter(Boolean).join(" ").toLowerCase();
  if (!combined.trim()) return false;

  return (
    combined.includes("funded startup") ||
    combined.includes("funded start-up") ||
    combined.includes("venture backed") ||
    combined.includes("vc backed") ||
    combined.includes("post-seed") ||
    combined.includes("series a") ||
    combined.includes("series b") ||
    combined.includes("series c") ||
    combined.includes("series d") ||
    (Boolean(fundingAmount?.trim()) && /seed|series|startup|start-up/i.test(combined))
  );
}

/**
 * ICP bucket labels list multiple stages (e.g. "Sweet Spot (Funded Start-up, SMB, SME)").
 * Use only the bucket family — never treat listed examples as this company's stage.
 */
function stageFromIcpBucket(icpBucket?: string): CompanyStage | null {
  const t = (icpBucket ?? "").trim().toLowerCase();
  if (!t) return null;
  if (t.includes("desirable") || t.includes("enterprise")) return "Enterprise";
  if (t.includes("potential") || t.includes("ideation") || t.includes("boutique")) {
    return "Ideation";
  }
  if (t.includes("sweet spot")) return "SMB";
  return null;
}

function stageFromKeywords(raw: string): CompanyStage | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;

  if (t.includes("enterprise") || t.includes("enterprice") || t.includes("fortune") || t.includes("large cap")) {
    return "Enterprise";
  }
  if (
    /series\s*[a-d]/.test(t) ||
    (t.includes("funded") && (t.includes("startup") || t.includes("start-up")))
  ) {
    return "Funded Startup";
  }
  if (t.includes("ideation") || t.includes("evaluation") || t.includes("pre-revenue")) {
    return "Ideation";
  }
  if (t.includes("startup") || t.includes("start-up") || t.includes("early stage") || t.includes("seed")) {
    return "Startup";
  }
  if (t.includes("smb") || t.includes("small business") || t.includes("sme") || t.includes("mid-market")) {
    return "SMB";
  }
  return null;
}

function stageFromRevenueSignals(
  annualRevenueRaw?: string,
  employeeCount?: string,
  fundingStage?: string,
  fundingAmount?: string
): CompanyStage | null {
  const rev = (annualRevenueRaw ?? "").toLowerCase();
  const emp = (employeeCount ?? "").toLowerCase();
  const funding = [fundingStage, fundingAmount].filter(Boolean).join(" ").toLowerCase();

  if (/\$?\s*\d+(\.\d+)?\s*b|\b\d{3,}m\b|billion|180m|100m/i.test(rev + emp)) {
    return "Enterprise";
  }

  if (isFundedStartupSignal(fundingStage, fundingAmount) || /series\s*[a-d]|venture|raised/i.test(funding)) {
    return "Funded Startup";
  }

  if (/series|seed|startup|pre-seed/i.test(rev + emp)) {
    return "Startup";
  }

  if (/\$?\s*\d+(\.\d+)?\s*m/i.test(rev) || /\b\d{2,3}\b/.test(emp)) {
    return "SMB";
  }

  if (/\$?\s*\d+k|\b\d{1,2}\b/.test(rev + emp)) {
    return "SMB";
  }

  return null;
}

/** Map CSV / API text to a canonical company stage. */
export function normalizeCompanyStage(sources: {
  rawStage?: string;
  companyTypeIcp?: string;
  icpBucket?: string;
  annualRevenueRaw?: string;
  employeeCount?: string;
  fundingStage?: string;
  fundingAmount?: string;
  seed?: string;
}): CompanyStage {
  // 1) Explicit Company Stage column wins (do not let ICP bucket labels override it).
  const fromExplicit = stageFromExplicitField(sources.rawStage);
  if (fromExplicit) return fromExplicit;

  // 2) Funding fields (not ICP bucket example text).
  if (isFundedStartupSignal(sources.fundingStage, sources.fundingAmount)) {
    return "Funded Startup";
  }

  // 3) Other free-text on the stage-like fields only (exclude ICP bucket).
  const fromText = stageFromKeywords(
    [sources.rawStage, sources.companyTypeIcp].filter(Boolean).join(" ")
  );
  if (fromText) return fromText;

  // 4) Revenue / headcount heuristics.
  const fromRevenue = stageFromRevenueSignals(
    sources.annualRevenueRaw,
    sources.employeeCount,
    sources.fundingStage,
    sources.fundingAmount
  );
  if (fromRevenue) return fromRevenue;

  // 5) Coarse ICP bucket family only.
  const fromBucket = stageFromIcpBucket(sources.icpBucket);
  if (fromBucket) return fromBucket;

  if (sources.seed) {
    return COMPANY_STAGES[hashString(sources.seed) % COMPANY_STAGES.length];
  }

  return "SMB";
}

export function companyStageForCall(call: {
  id?: string;
  dealStage?: string;
  companyTypeIcp?: string;
  icpBucket?: string;
  annualRevenueRaw?: string;
  employeeCount?: string;
}): CompanyStage {
  return normalizeCompanyStage({
    rawStage: call.dealStage,
    companyTypeIcp: call.companyTypeIcp,
    icpBucket: call.icpBucket,
    annualRevenueRaw: call.annualRevenueRaw,
    employeeCount: call.employeeCount,
    seed: call.id,
  });
}
