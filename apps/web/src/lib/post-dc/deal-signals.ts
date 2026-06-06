import type { PostCallReview, PostDcDealSignals } from "@/lib/brief-types";

export function resolveLeadStage(review: PostCallReview): string {
  const fromSignals = review.dealSignals?.leadStage?.trim();
  if (fromSignals) return fromSignals;
  const first = review.headline.split("·")[0]?.trim();
  return first ?? "";
}

export function isNotFitLeadStage(leadStage: string): boolean {
  return leadStage.toLowerCase().includes("not a fit");
}

export function isNurtureLeadStage(leadStage: string): boolean {
  return leadStage.toLowerCase() === "nurture";
}

export function resolveDealSignals(review: PostCallReview): PostDcDealSignals {
  if (review.dealSignals && Object.keys(review.dealSignals).length > 0) {
    return review.dealSignals;
  }

  const fromSections: PostDcDealSignals = {};
  for (const section of review.researchSections ?? []) {
    for (const item of section.items ?? []) {
      const label = item.label.toLowerCase();
      const value = item.value?.trim();
      if (!value) continue;
      if (label.includes("lead stage")) fromSections.leadStage = value;
      if (label.includes("engagement model")) fromSections.engagementModel = value;
      if (label.includes("annual potential")) fromSections.accountsAnnualPotential = value;
      if (label.includes("service line")) fromSections.serviceLine = value;
      if (label.includes("icp bucket correct") || label.includes("pre-dc icp")) {
        fromSections.icpBucketCorrect = value;
      }
      if (label.includes("reason not fit")) fromSections.reasonNotFit = value;
      if (label.includes("additional info")) fromSections.additionalInfo = value;
      if (label === "attendees") fromSections.attendees = value;
    }
  }

  if (!fromSections.leadStage) {
    fromSections.leadStage = resolveLeadStage(review);
  }

  return fromSections;
}
