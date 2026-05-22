import { PRE_DC_HEADERS, type PreDCRecord } from "@/types/dc-notes";

export interface CreatePreDcRecordOptions {
  companyName?: string;
  leadName?: string;
  discoveryCallDatePkt?: string;
  discoveryCallTimePkt?: string;
}

/** Build an empty Pre-DC row with every CSV column present for manual entry. */
export function createEmptyPreDcRecord(options: CreatePreDcRecordOptions = {}): PreDCRecord {
  const id = `pre-manual-${crypto.randomUUID()}`;
  const fields: Record<string, string> = {};
  for (const header of Object.values(PRE_DC_HEADERS)) {
    fields[header] = "";
  }
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
  return { id, fields };
}

/** Map PreDCRecord field keys to human-readable form labels. */
export const PRE_DC_FIELD_ENTRIES = (
  Object.entries(PRE_DC_HEADERS) as [keyof typeof PRE_DC_HEADERS, string][]
).map(([key, header]) => ({ key, header }));
