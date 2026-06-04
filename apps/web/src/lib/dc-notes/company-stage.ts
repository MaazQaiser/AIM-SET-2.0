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

function matchCanonicalStage(raw: string): CompanyStage | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  const hit = COMPANY_STAGES.find((s) => s.toLowerCase() === t);
  if (hit) return hit;
  if (t.includes("funded") && t.includes("startup")) return "Funded Startup";
  return null;
}

function isFundedStartupSignal(text: string, fundingStage?: string, fundingAmount?: string): boolean {
  const combined = [text, fundingStage, fundingAmount].filter(Boolean).join(" ").toLowerCase();
  if (!combined.trim()) return false;

  if (
    combined.includes("funded startup") ||
    combined.includes("funded start-up") ||
    combined.includes("venture backed") ||
    combined.includes("vc backed") ||
    combined.includes("post-seed") ||
    combined.includes("series a") ||
    combined.includes("series b") ||
    combined.includes("series c") ||
    combined.includes("series d") ||
    (combined.includes("seed") && (fundingAmount?.trim() || fundingStage?.trim()))
  ) {
    return true;
  }

  return Boolean(fundingAmount?.trim() && /startup|seed|series/i.test(combined));
}

function stageFromKeywords(
  raw: string,
  fundingStage?: string,
  fundingAmount?: string
): CompanyStage | null {
  const canonical = matchCanonicalStage(raw);
  if (canonical) return canonical;

  const t = raw.trim().toLowerCase();
  if (!t && !fundingStage && !fundingAmount) return null;

  if (
    t.includes("enterprise") ||
    t.includes("enterprice") ||
    t.includes("desirable") ||
    t.includes("large cap") ||
    t.includes("fortune")
  ) {
    return "Enterprise";
  }

  if (isFundedStartupSignal(t, fundingStage, fundingAmount)) {
    return "Funded Startup";
  }

  if (
    t.includes("startup") ||
    t.includes("start-up") ||
    t.includes("seed") ||
    t.includes("early stage")
  ) {
    return "Startup";
  }

  if (
    t.includes("ideation") ||
    t.includes("evaluation") ||
    t.includes("discovery") ||
    t.includes("active opportunity") ||
    t.includes("pre-revenue")
  ) {
    return "Ideation";
  }

  if (
    t.includes("smb") ||
    t.includes("small business") ||
    t.includes("small cap") ||
    t.includes("mid-market") ||
    t.includes("sme")
  ) {
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

  if (
    /series\s*[a-d]|venture|funded|raised/i.test(rev + funding) ||
    (fundingAmount?.trim() && /seed|series/i.test(funding))
  ) {
    return "Funded Startup";
  }

  if (/series|seed|startup|pre-seed/i.test(rev + emp)) {
    return "Startup";
  }

  if (/\$?\s*\d+(\.\d+)?\s*m/i.test(rev) || /\b\d{2,3}\b/.test(emp)) {
    return "Startup";
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
  const combined = [
    sources.rawStage,
    sources.companyTypeIcp,
    sources.icpBucket,
  ]
    .filter(Boolean)
    .join(" ");

  const fromText = stageFromKeywords(
    combined,
    sources.fundingStage,
    sources.fundingAmount
  );
  if (fromText) return fromText;

  const fromRevenue = stageFromRevenueSignals(
    sources.annualRevenueRaw,
    sources.employeeCount,
    sources.fundingStage,
    sources.fundingAmount
  );
  if (fromRevenue) return fromRevenue;

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
