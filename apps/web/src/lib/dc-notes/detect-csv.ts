import { POST_DC_HEADERS, PRE_DC_HEADERS, type DcCsvKind } from "@/types/dc-notes";

export function detectDcCsvKind(headers: string[]): DcCsvKind {
  const set = new Set(headers.map((h) => h.trim()));
  if (set.has(PRE_DC_HEADERS.companyName)) return "pre-dc";
  if (set.has(POST_DC_HEADERS.leadStage) && set.has(POST_DC_HEADERS.bottomLineContext)) {
    return "post-dc";
  }
  return "unknown";
}
