import type { PodRole } from "@/types";

export const POD_MEMBER_DISPLAY: Record<
  PodRole,
  { name: string; initials: string; designation: string }
> = {
  ae: { name: "Sarah Mendes", initials: "SM", designation: "Account Executive" },
  se: { name: "Tariq Hassan", initials: "TH", designation: "Solutions Architect" },
  designer: { name: "Alex Rivera", initials: "AR", designation: "Product Designer" },
};

export function podDisplayForRole(role: PodRole | "leadership") {
  if (role === "leadership") return POD_MEMBER_DISPLAY.ae;
  return POD_MEMBER_DISPLAY[role] ?? POD_MEMBER_DISPLAY.ae;
}
