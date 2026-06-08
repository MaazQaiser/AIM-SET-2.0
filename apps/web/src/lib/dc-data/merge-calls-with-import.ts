import { enrichCallBant } from "@/lib/bant/authority-from-lead";
import { resolveMergedCallStatus } from "@/lib/dc-data/call-status";
import { companyStageForCall } from "@/lib/dc-notes/company-stage";
import type { Call, CallStatus } from "@/types";

/** API list calls are sparse; fill display fields from CSV-built import rows. */
export function mergeCallsWithImport(
  apiCalls: Call[],
  imported: Call[],
  statusOverrides: Record<string, CallStatus> = {}
): Call[] {
  if (imported.length === 0) {
    return apiCalls.map((call) =>
      statusOverrides[call.id] ? { ...call, status: statusOverrides[call.id] } : call
    );
  }

  const byId = new Map(imported.map((c) => [c.id, c]));

  return apiCalls.map((api) => {
    const local = byId.get(api.id);
    if (!local) return api;

    const status = resolveMergedCallStatus({
      apiStatus: api.status,
      localStatus: local.status,
      overrideStatus: statusOverrides[api.id],
    });

    const merged = {
      ...local,
      ...api,
      scheduledAt: local.scheduledAt || api.scheduledAt,
      status,
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
      bant: status === "completed" && local.bant ? local.bant : api.bant ?? local.bant,
    };

    return {
      ...merged,
      bant: enrichCallBant(merged.bant, {
        leadTitle: merged.leadTitle,
      }),
    };
  });
}
