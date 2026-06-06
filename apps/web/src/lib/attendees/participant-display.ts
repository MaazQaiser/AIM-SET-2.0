import type { PodRole } from "@/types";

const INTERNAL_ROLES = new Set<string>(["ae", "se", "designer"]);

export type ParticipantKind = "internal" | "external";

/** Soft pastel fills — deterministic per person, visible behind avatar art. */
const AVATAR_PASTEL_BACKGROUNDS = [
  "#e8f0fe",
  "#f3e8ff",
  "#e8f5ee",
  "#fdf2e8",
  "#fce8f0",
  "#eef6e8",
  "#f0eef8",
  "#e8f4f8",
  "#fef3e8",
  "#ede8fe",
] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function avatarPastelBackground(name: string, seed?: string): string {
  const key = (seed?.trim() || name.trim() || "avatar").toLowerCase();
  return AVATAR_PASTEL_BACKGROUNDS[hashString(key) % AVATAR_PASTEL_BACKGROUNDS.length];
}

function dicebearBackgroundParam(color: string): string {
  return color.replace("#", "");
}

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
  const bg = dicebearBackgroundParam(avatarPastelBackground(name, seed));
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed}&backgroundColor=${bg}`;
}

/** Soft illustrated avatar for client / lead contacts (not letter initials). */
export function externalAvatarUrl(name: string, seed?: string): string {
  const avatarSeed = encodeURIComponent(seed?.trim() || name.trim() || "contact");
  const bg = dicebearBackgroundParam(avatarPastelBackground(name, seed));
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${avatarSeed}&backgroundColor=${bg}`;
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
  ae: { className: "text-primary" },
  se: { className: "text-success" },
  designer: { className: "text-warning-foreground" },
  customer: { className: "text-foreground/80" },
  default: { className: "text-foreground/80" },
};
