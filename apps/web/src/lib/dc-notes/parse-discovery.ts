import { isValid, parse } from "date-fns";

/** Pakistan Standard Time is UTC+5 year-round (no DST). */
export const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export function toPktParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + PKT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function isSamePktDay(a: Date, b: Date): boolean {
  const pa = toPktParts(a);
  const pb = toPktParts(b);
  return pa.year === pb.year && pa.month === pb.month && pa.day === pb.day;
}

function pktWallToIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): string {
  // Wall clock is Asia/Karachi; convert to UTC by subtracting the PKT offset.
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0) - PKT_OFFSET_MS).toISOString();
}

export function parseDiscoveryDateTime(datePkt: string, timePkt: string): string | null {
  const dateStr = datePkt.trim();
  if (!dateStr) return null;

  const dateFormats = [
    "yyyy-MM-dd",
    "M/d/yyyy",
    "MM/dd/yyyy",
    "M/d/yy",
    "MM/dd/yy",
  ];
  let base: Date | null = null;

  for (const fmt of dateFormats) {
    const parsed = parse(dateStr, fmt, new Date());
    if (isValid(parsed)) {
      base = parsed;
      break;
    }
  }

  if (!base) return null;

  let hour = 0;
  let minute = 0;
  const timeStr = timePkt.trim();
  if (timeStr) {
    const timeFormats = ["h:mm a", "hh:mm a", "H:mm", "HH:mm", "h a"];
    for (const fmt of timeFormats) {
      const timeParsed = parse(timeStr, fmt, new Date());
      if (isValid(timeParsed)) {
        hour = timeParsed.getHours();
        minute = timeParsed.getMinutes();
        break;
      }
    }
  }

  return pktWallToIso(
    base.getFullYear(),
    base.getMonth() + 1,
    base.getDate(),
    hour,
    minute
  );
}

/** Upcoming if discovery date is today or in the future (by PKT calendar day) */
export function isDiscoveryCallUpcoming(scheduledAtIso: string): boolean {
  const at = new Date(scheduledAtIso);
  const today = toPktParts(new Date());
  const callDay = toPktParts(at);
  if (callDay.year !== today.year || callDay.month !== today.month) {
    return callDay.year > today.year || (callDay.year === today.year && callDay.month > today.month);
  }
  return callDay.day >= today.day;
}
