import { cn } from "@/lib/cn";
import { ParticipantAvatar } from "@/components/participant-avatar";
import type { PodMember } from "@/types";

const roleLabels: Record<string, string> = {
  ae: "AE",
  se: "SE",
  designer: "Designer",
};

const roleColors: Record<string, string> = {
  ae: "bg-primary/10 text-primary border-primary/20",
  se: "bg-success/10 text-success border-success/20",
  designer: "bg-warning/10 text-warning-foreground border-warning/20",
};

interface PodMemberBadgeProps {
  member: PodMember;
  showRole?: boolean;
  size?: "sm" | "default";
}

export function PodMemberBadge({ member, showRole = true, size = "sm" }: PodMemberBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        roleColors[member.role],
        size === "sm" ? "text-xs" : "text-sm"
      )}
    >
      <ParticipantAvatar
        name={member.name}
        kind="internal"
        avatarUrl={member.avatarUrl}
        initials={member.initials}
        role={member.role}
        size={size === "sm" ? "xs" : "sm"}
      />
      <span className="font-medium">{member.name}</span>
      {showRole && (
        <span className="opacity-70">· {roleLabels[member.role]}</span>
      )}
    </div>
  );
}
