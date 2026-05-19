import { isValid, parse, startOfDay } from "date-fns";

export function parseDiscoveryDateTime(datePkt: string, timePkt: string): string | null {
  const dateStr = datePkt.trim();
  if (!dateStr) return null;

  const dateFormats = ["M/d/yyyy", "MM/dd/yyyy", "d/M/yyyy", "dd/MM/yyyy", "M/d/yy", "MM/dd/yy"];
  let base: Date | null = null;

  for (const fmt of dateFormats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) {
      base = parsed;
      break;
    }
  }

  if (!base) return null;

  const timeStr = timePkt.trim();
  if (timeStr) {
    const timeFormats = ["h:mm a", "hh:mm a", "H:mm", "h a"];
    for (const fmt of timeFormats) {
      const timeParsed = parse(timeStr, fmt, new Date());
      if (isValid(timeParsed)) {
        base.setHours(timeParsed.getHours(), timeParsed.getMinutes(), 0, 0);
        break;
      }
    }
  }

  return base.toISOString();
}

/** Upcoming if discovery date is today or in the future (by calendar day) */
export function isDiscoveryCallUpcoming(scheduledAtIso: string): boolean {
  return new Date(scheduledAtIso).getTime() >= startOfDay(new Date()).getTime();
}
