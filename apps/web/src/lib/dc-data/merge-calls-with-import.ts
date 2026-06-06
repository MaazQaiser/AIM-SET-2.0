import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { companyStageForCall } from "@/lib/dc-notes/company-stage";
import type { Call } from "@/types";

/** API list calls are sparse; fill display fields from CSV-built import rows. */
export function mergeCallsWithImport(apiCalls: Call[], imported: Call[]): Call[] {
  if (imported.length === 0) return apiCalls;

  const byId = new Map(imported.map((c) => [c.id, c]));

  return apiCalls.map((api) => {
    const local = byId.get(api.id);
    if (!local) return api;

    const postDcWrapped = local.status === "completed";
    const manualWrapped = api.status === "completed" && !postDcWrapped;

    const merged = {
      ...local,
      ...api,
      scheduledAt: local.scheduledAt || api.scheduledAt,
      status: postDcWrapped || manualWrapped ? "completed" : local.status ?? api.status ?? "upcoming",
      dealStage: companyStageForCall({
        ...local,
        ...api,
        dealStage: api.dealStage?.trim() || local.dealStage,
      }),
      industry: api.industry?.trim() || local.industry,
      icpBucket: api.icpBucket?.trim() || local.icpBucket,
      icpMatch: api.icpMatch ?? local.icpMatch,
      leadName: api.leadName?.trim() || local.leadName,
      leadTitle: api.leadTitle?.trim() || local.leadTitle,
      discoveryCallDatePkt: api.discoveryCallDatePkt || local.discoveryCallDatePkt,
      discoveryCallTimePkt: api.discoveryCallTimePkt || local.discoveryCallTimePkt,
      annualRevenue: api.annualRevenue || local.annualRevenue,
      employeeCount: api.employeeCount || local.employeeCount,
      companyTypeIcp: api.companyTypeIcp || local.companyTypeIcp,
      website: api.website || local.website,
      meetingUrl: api.meetingUrl || local.meetingUrl,
      pod: api.pod?.length ? api.pod : local.pod,
      bant: postDcWrapped && local.bant ? local.bant : api.bant ?? local.bant,
    };

    return {
      ...merged,
      bant: enrichCallBant(merged.bant, {
        leadTitle: merged.leadTitle,
      }),
    };
  });
}
