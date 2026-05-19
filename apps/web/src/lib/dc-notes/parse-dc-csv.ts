import { parseCsv, rowsToRecords } from "@/lib/csv/parse";
import { detectDcCsvKind } from "@/lib/dc-notes/detect-csv";
import type { DcCsvKind, PreDCRecord, PostDCRecord } from "@/types/dc-notes";
import { PRE_DC_HEADERS } from "@/types/dc-notes";

export interface DcCsvParseResult {
  kind: DcCsvKind;
  headers: string[];
  errors: string[];
  preDcRecords: PreDCRecord[];
  postDcRecords: PostDCRecord[];
}

export function parseDcNotesCsv(text: string): DcCsvParseResult {
  const { headers, rows } = parseCsv(text);
  const kind = detectDcCsvKind(headers);
  const errors: string[] = [];

  if (headers.length === 0) {
    return { kind: "unknown", headers, errors: ["File is empty."], preDcRecords: [], postDcRecords: [] };
  }

  if (kind === "unknown") {
    return {
      kind,
      headers,
      errors: [
        "Unrecognized CSV format. Use pre_dc_notes_data.csv or post_dc_notes_data.csv column headers.",
      ],
      preDcRecords: [],
      postDcRecords: [],
    };
  }

  const records = rowsToRecords(headers, rows);

  if (kind === "pre-dc") {
    const preDcRecords: PreDCRecord[] = [];
    records.forEach((fields, index) => {
      const company = fields[PRE_DC_HEADERS.companyName]?.trim();
      if (!company) {
        errors.push(`Row ${index + 2}: missing ${PRE_DC_HEADERS.companyName}`);
        return;
      }
      preDcRecords.push({
        id: `pre-${index}-${company.slice(0, 24).replace(/\W+/g, "-")}`,
        fields,
      });
    });
    if (preDcRecords.length === 0 && errors.length === 0) {
      errors.push("No valid Pre-DC rows found.");
    }
    return { kind, headers, errors, preDcRecords, postDcRecords: [] };
  }

  const postDcRecords: PostDCRecord[] = records.map((fields, index) => ({
    id: `post-${index}`,
    fields,
  }));

  if (postDcRecords.length === 0) {
    errors.push("No Post-DC rows found.");
  }

  return { kind, headers, errors, preDcRecords: [], postDcRecords };
}
