import type { PodRole } from "@/types";

const INTERNAL_ROLES = new Set<string>(["ae", "se", "designer"]);

export type ParticipantKind = "internal" | "external";

export function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function participantKindFromRole(role?: string): ParticipantKind {
  if (role && INTERNAL_ROLES.has(role)) return "internal";
  return "external";
}

export function internalAvatarUrl(name: string, seed?: string): string {
  const avatarSeed = encodeURIComponent(seed?.trim() || name.trim() || "team");
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}`;
}

export function resolveParticipantInitials(name: string, initials?: string): string {
  const trimmed = initials?.trim();
  if (trimmed) return trimmed.slice(0, 2).toUpperCase();
  return initialsFromName(name);
}

export const ROLE_AVATAR_STYLES: Record<
  PodRole | "customer" | "default",
  { className: string }
> = {
  ae: { className: "bg-primary/10 text-primary" },
  se: { className: "bg-success/10 text-success" },
  designer: { className: "bg-warning/10 text-warning-foreground" },
  customer: { className: "bg-muted text-foreground" },
  default: { className: "bg-muted text-foreground" },
};
