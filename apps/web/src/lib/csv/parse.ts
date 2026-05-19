/** RFC-style CSV parser with quoted fields and multiline cell support. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const cleaned = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];

    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || (c === "\r" && cleaned[i + 1] === "\n")) {
      row.push(cell);
      cell = "";
      if (row.some((v) => v.trim().length > 0)) rows.push(row);
      row = [];
      if (c === "\r") i++;
    } else if (c !== "\r") {
      cell += c;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((v) => v.trim().length > 0)) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };

  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((cells) => {
    const record: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      record.push((cells[i] ?? "").trim());
    }
    return record;
  });

  return { headers, rows: dataRows };
}

export function rowsToRecords(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) record[header] = cells[i] ?? "";
    });
    return record;
  });
}
