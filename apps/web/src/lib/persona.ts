export type Persona = "ae" | "leadership" | "content-owner";

export const PERSONA_LABELS: Record<Persona, string> = {
  ae: "Account Executive",
  leadership: "Sales Leadership",
  "content-owner": "Content Owner",
};

export function personaFromMetadata(publicMetadata?: Record<string, unknown>): Persona {
  const role = publicMetadata?.dcRole ?? publicMetadata?.role;
  if (role === "leadership" || role === "vp" || role === "manager") return "leadership";
  if (role === "content-owner" || role === "content") return "content-owner";
  return "ae";
}
