/** ICP fit score (0–1) derived from imported ICP bucket labels. */
export function icpScoreFromBucket(bucket: string): number {
  const b = bucket.trim().toLowerCase();
  if (!b) return 0.55;
  if (b.includes("enterprise") || b.includes("desirable")) return 0.88;
  if (b.includes("sweet spot") || b.includes("sweet")) return 0.78;
  if (b.includes("potential")) return 0.62;
  return 0.55;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Agent sales rating: whole number 1–8, stable per call id. */
export function companyRatingForCall(call: {
  id?: string;
  icpMatch?: number;
  icpBucket?: string;
}): number {
  const fit =
    typeof call.icpMatch === "number" && Number.isFinite(call.icpMatch)
      ? call.icpMatch
      : icpScoreFromBucket(call.icpBucket ?? "");

  let min = 1;
  let max = 4;
  if (fit >= 0.85) {
    min = 7;
    max = 8;
  } else if (fit >= 0.74) {
    min = 5;
    max = 7;
  } else if (fit >= 0.58) {
    min = 3;
    max = 6;
  }

  const span = max - min;
  const seed = call.id ?? call.icpBucket ?? "default";
  const step = hashString(seed) % (span + 1);
  return min + step;
}

export function formatCompanyRating(score: number): string {
  return String(Math.round(score));
}
