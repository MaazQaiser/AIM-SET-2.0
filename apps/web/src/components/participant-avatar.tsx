"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@dc-copilot/ui/components/avatar";
import { cn } from "@/lib/cn";
import {
  internalAvatarUrl,
  participantKindFromRole,
  resolveParticipantInitials,
  ROLE_AVATAR_STYLES,
  type ParticipantKind,
} from "@/lib/attendees/participant-display";
import type { PodRole } from "@/types";

const SIZE_CLASS = {
  xs: "h-5 w-5 text-[8px]",
  sm: "h-6 w-6 text-[9px]",
  md: "h-8 w-8 text-[10px]",
  lg: "h-10 w-10 text-xs",
  xl: "h-12 w-12 text-sm",
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
  const styleKey = role ?? (resolvedKind === "internal" ? "default" : "customer");
  const fallbackClass = ROLE_AVATAR_STYLES[styleKey]?.className ?? ROLE_AVATAR_STYLES.default.className;
  const imageSrc =
    resolvedKind === "internal"
      ? avatarUrl?.trim() || internalAvatarUrl(name, initials || name)
      : undefined;

  return (
    <Avatar
      className={cn(SIZE_CLASS[size], className)}
      title={title ?? name}
      aria-label={name}
    >
      {imageSrc ? <AvatarImage src={imageSrc} alt={name} /> : null}
      <AvatarFallback className={cn("font-semibold", fallbackClass)}>
        {resolvedInitials}
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
