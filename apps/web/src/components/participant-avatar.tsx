"use client";

import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@dc-copilot/ui/components/avatar";
import { cn } from "@/lib/cn";
import {
  avatarPastelBackground,
  externalAvatarUrl,
  internalAvatarUrl,
  participantKindFromRole,
  resolveParticipantInitials,
  ROLE_AVATAR_STYLES,
  type ParticipantKind,
} from "@/lib/attendees/participant-display";
import type { PodRole } from "@/types";

const SIZE_CLASS = {
  xs: "h-6 w-6",
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
} as const;

const FALLBACK_TEXT_CLASS = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-[11px]",
  lg: "text-xs",
  xl: "text-sm",
} as const;

const EXTERNAL_ICON_CLASS = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
} as const;

export interface ParticipantAvatarProps {
  name: string;
  kind?: ParticipantKind;
  avatarUrl?: string;
  initials?: string;
  role?: PodRole | "customer";
  size?: keyof typeof SIZE_CLASS;
  className?: string;
  title?: string;
}

export function ParticipantAvatar({
  name,
  kind,
  avatarUrl,
  initials,
  role,
  size = "md",
  className,
  title,
}: ParticipantAvatarProps) {
  const resolvedKind = kind ?? participantKindFromRole(role);
  const resolvedInitials = resolveParticipantInitials(name, initials);
  const seed = initials || name;
  const pastelBg = avatarPastelBackground(name, seed);
  const styleKey = role ?? (resolvedKind === "internal" ? "default" : "customer");
  const fallbackClass = ROLE_AVATAR_STYLES[styleKey]?.className ?? ROLE_AVATAR_STYLES.default.className;
  const imageSrc =
    resolvedKind === "internal"
      ? avatarUrl?.trim() || internalAvatarUrl(name, seed)
      : avatarUrl?.trim() || externalAvatarUrl(name, seed);

  return (
    <Avatar
      className={cn(
        SIZE_CLASS[size],
        "ring-1 ring-black/[0.05] dark:ring-white/10",
        className
      )}
      style={{ backgroundColor: pastelBg }}
      title={title ?? name}
      aria-label={name}
    >
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} className="object-cover" /> : null}
      <AvatarFallback
        className={cn(
          "bg-transparent",
          resolvedKind === "external"
            ? "text-muted-foreground"
            : cn("font-medium tracking-tight", FALLBACK_TEXT_CLASS[size], fallbackClass)
        )}
        style={{ backgroundColor: pastelBg }}
      >
        {resolvedKind === "external" ? (
          <UserRound className={EXTERNAL_ICON_CLASS[size]} strokeWidth={2} aria-hidden />
        ) : (
          resolvedInitials
        )}
      </AvatarFallback>
    </Avatar>
  );
}

export interface ParticipantNameRowProps extends ParticipantAvatarProps {
  subtitle?: string;
  meta?: React.ReactNode;
  reverse?: boolean;
}

export function ParticipantNameRow({
  name,
  subtitle,
  meta,
  reverse = false,
  size = "md",
  ...avatarProps
}: ParticipantNameRowProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2",
        reverse && "flex-row-reverse text-right"
      )}
    >
      <ParticipantAvatar name={name} size={size} {...avatarProps} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          {meta}
        </div>
        {subtitle ? (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}
