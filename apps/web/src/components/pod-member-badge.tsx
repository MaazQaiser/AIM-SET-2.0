import { cn } from "@/lib/cn";
import { Avatar, AvatarFallback, AvatarImage } from "@dc-copilot/ui/components/avatar";
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
      <Avatar className={size === "sm" ? "h-4 w-4" : "h-5 w-5"}>
        {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
        <AvatarFallback
          className={cn("text-[8px] font-semibold", roleColors[member.role])}
        >
          {member.initials}
        </AvatarFallback>
      </Avatar>
      <span className="font-medium">{member.name}</span>
      {showRole && (
        <span className="opacity-70">· {roleLabels[member.role]}</span>
      )}
    </div>
  );
}
