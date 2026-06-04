import type { ClientAttendee } from "@dc-copilot/types/brief";
import type { BANTScore, BANTStatus } from "@/types";

const C_SUITE_TITLE =
  /\b(?:c[\s.-]?suite|c[\s.-]?panel)\b|(?:\bchief\s+(?:executive|operating|financial|technology|marketing|product|revenue|information|data|digital|strategy|commercial|people|human\s+resources|legal|security|privacy|customer|growth|transformation|risk|compliance|analytics)(?:\s+officer)?\b)|\b(?:CEO|CFO|COO|CTO|CMO|CPO|CRO|CIO|CISO|CHRO|CCO|CDO|CAO|CBO|CGO|CKO)\b/i;

const EXECUTIVE_TITLE =
  /\b(?:president|chair(?:man|woman|person)?|founder|co[\s-]?founder|owner|managing\s+director|executive\s+director|board\s+member)\b/i;

const SENIOR_LEADER_TITLE =
  /\b(?:executive\s+vice\s+president|evp|senior\s+vice\s+president|svp|vice\s+president|\bvp\b|director|head\s+of|general\s+manager|partner|principal)\b/i;

function bantRank(status: BANTStatus): number {
  if (status === "confirmed") return 2;
  if (status === "partial") return 1;
  return 0;
}

function maxBantStatus(a: BANTStatus, b: BANTStatus): BANTStatus {
  return bantRank(a) >= bantRank(b) ? a : b;
}

/** Infer authority from a single job title (lead / client attendee). */
export function authorityStatusFromTitle(title: string): BANTStatus | null {
  const normalized = title.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (C_SUITE_TITLE.test(normalized) || EXECUTIVE_TITLE.test(normalized)) {
    return "confirmed";
  }
  if (SENIOR_LEADER_TITLE.test(normalized)) return "partial";
  return null;
}

export type LeadAuthorityContext = {
  leadTitle?: string | null;
  clientAttendees?: Pick<ClientAttendee, "title" | "influenceLevel">[] | null;
};

/** Best authority signal from who is joining on the lead/customer side. */
export function inferAuthorityFromLeadContext(ctx: LeadAuthorityContext): BANTStatus | null {
  let best: BANTStatus | null = null;

  const consider = (status: BANTStatus | null) => {
    if (!status) return;
    best = best ? maxBantStatus(best, status) : status;
  };

  if (ctx.leadTitle?.trim()) {
    consider(authorityStatusFromTitle(ctx.leadTitle));
  }

  for (const attendee of ctx.clientAttendees ?? []) {
    if (attendee.title?.trim()) {
      consider(authorityStatusFromTitle(attendee.title));
    }
    if (attendee.influenceLevel === "decision-maker") {
      consider("partial");
    }
  }

  return best;
}

const DEFAULT_BANT: BANTScore = {
  budget: "unknown",
  authority: "unknown",
  need: "unknown",
  timeline: "unknown",
};

/** Upgrade authority when lead-side role indicates executive sponsorship. */
export function enrichCallBant(
  bant: BANTScore | undefined,
  ctx: LeadAuthorityContext
): BANTScore {
  const base = bant ?? DEFAULT_BANT;
  const inferred = inferAuthorityFromLeadContext(ctx);
  if (!inferred) return base;
  return {
    ...base,
    authority: maxBantStatus(base.authority, inferred),
  };
}
