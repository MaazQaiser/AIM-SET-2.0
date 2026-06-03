import type { KBProject } from "@/types";

export function formatProjectDate(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatBriefLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

export function projectFieldEntries(
  project: KBProject,
  limit = 18
): Array<{ key: string; label: string; value: string }> {
  return Object.entries(project.fields ?? {})
    .map(([key, value]) => ({
      key,
      label: formatBriefLabel(key),
      value,
    }))
    .filter((entry) => entry.value.trim().length > 0)
    .slice(0, limit);
}

export function projectSearchText(project: KBProject): string {
  return [
    project.title,
    project.projectName,
    project.companyName,
    project.summary,
    project.industry,
    project.sector,
    project.domain,
    project.subDomain,
    project.companyStage,
    project.problemStatement,
    project.businessOutcome,
    project.functionalSolution,
    project.technicalSolution,
    project.sourceAssetTitle,
    project.sourceFileName,
    project.tags?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function uniqueProjectValues(projects: KBProject[], key: keyof KBProject, limit = 8): string[] {
  const counts = new Map<string, number>();
  for (const project of projects) {
    const value = project[key];
    if (typeof value !== "string" || !value.trim()) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, limit)
    .map(([value]) => value);
}

export function primarySolution(project: KBProject): string {
  return (
    project.technicalSolution ||
    project.functionalSolution ||
    project.businessOutcome ||
    project.problemStatement ||
    project.summary
  );
}

export function compactText(value?: string | null, limit = 240): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3).trim()}...`;
}
