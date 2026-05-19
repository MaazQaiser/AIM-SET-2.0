/** Format raw CSV revenue e.g. "960,000" or "3,800,000" for display */
export function formatCompanyRevenue(raw: string | undefined): string | undefined {
  if (!raw?.trim()) return undefined;
  const cleaned = raw.replace(/[$,\s]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num) || num <= 0) return raw.trim();
  if (num >= 1_000_000_000) return `$${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(0)}K`;
  return `$${num.toLocaleString()}`;
}
