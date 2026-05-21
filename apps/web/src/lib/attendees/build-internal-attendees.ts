import type { InternalAttendee } from "@/lib/brief-types";
import type { Call, PodMember } from "@/types";

const ROLE_LABELS: Record<InternalAttendee["role"], string> = {
  ae: "Account Executive",
  se: "Solutions Engineer",
  designer: "Product Designer",
};

const DEFAULT_POD: PodMember[] = [
  { id: "ae-sarah", name: "Sarah Chen", role: "ae", initials: "SC" },
  { id: "se-tariq", name: "Tariq Ali", role: "se", initials: "TA" },
  { id: "designer-priya", name: "Priya Raman", role: "designer", initials: "PR" },
];

export function buildInternalAttendeesFromPreDc(
  callId: string,
  ctx: {
    industry?: string;
    intersection?: string;
    needs?: string;
    relevance?: string;
    techStacks?: string;
    technicalBackground?: string;
  }
): InternalAttendee[] {
  const account = ctx.industry || "this account";

  return [
    {
      id: `${callId}-ae-sarah`,
      name: "Sarah Chen",
      role: "ae",
      designation: `${ROLE_LABELS.ae} · Pod lead`,
      fitReason:
        ctx.relevance ||
        ctx.intersection ||
        `Leads commercial discovery, maps stakeholders, and ties ${account} priorities to our service lines.`,
      initials: "SC",
    },
    {
      id: `${callId}-se-tariq`,
      name: "Tariq Ali",
      role: "se",
      designation: ROLE_LABELS.se,
      fitReason:
        [ctx.techStacks, ctx.technicalBackground].filter(Boolean).join(" · ") ||
        `Covers architecture and integration depth when ${account} discusses platforms, compliance, or build vs. buy.`,
      initials: "TA",
    },
    {
      id: `${callId}-designer-priya`,
      name: "Priya Raman",
      role: "designer",
      designation: ROLE_LABELS.designer,
      fitReason:
        ctx.needs ||
        `Joins when UX, product surfaces, or delivery model need visual framing — especially if ${account} describes end-user workflows.`,
      initials: "PR",
    },
  ];
}

/** Prefer brief payload; fall back to call.pod with generic fit copy. */
export function resolveInternalAttendees(
  briefInternal?: InternalAttendee[],
  call?: Call
): InternalAttendee[] {
  if (briefInternal && briefInternal.length > 0) {
    return briefInternal;
  }

  const pod = call?.pod?.length ? call.pod : DEFAULT_POD;
  return pod.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role,
    designation: ROLE_LABELS[member.role],
    fitReason: `Assigned to support ${ROLE_LABELS[member.role].toLowerCase()} responsibilities on this discovery call.`,
    initials: member.initials,
    avatarUrl: member.avatarUrl,
  }));
}
