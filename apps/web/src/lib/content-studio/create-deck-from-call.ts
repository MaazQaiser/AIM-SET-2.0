import type { TranscriptEvent } from "@/types";
import type { DiscoveryChecklistState } from "@dc-copilot/types";

interface CallContext {
  callId: string;
  accountName: string;
  transcript: TranscriptEvent[];
  checklistState?: DiscoveryChecklistState | null;
  painPoints?: string[];
  intentLabel?: string;
}

function extractPainPoints(transcript: TranscriptEvent[]): string[] {
  const painKeywords = [
    "pain", "problem", "challenge", "struggling", "friction", "bottleneck",
    "limitation", "issue", "difficult", "concern", "worried", "frustrat",
    "overcome", "gap", "lack", "missing", "broken", "slow", "manual",
    "expensive", "complex", "tedious",
  ];
  const pains: string[] = [];
  const seen = new Set<string>();

  for (const event of transcript) {
    const text = (event.text ?? "").toLowerCase();
    const role = event.speakerRole ?? "customer";
    if (role !== "customer") continue;

    for (const kw of painKeywords) {
      if (text.includes(kw)) {
        const snippet = event.text.trim();
        const key = snippet.slice(0, 60).toLowerCase();
        if (!seen.has(key) && snippet.length > 10) {
          seen.add(key);
          pains.push(snippet);
        }
        break;
      }
    }
  }
  return pains.slice(0, 8);
}

function buildDeckPrompt(ctx: CallContext): string {
  const pains = ctx.painPoints?.length
    ? ctx.painPoints
    : extractPainPoints(ctx.transcript);

  const bantStatus = ctx.checklistState?.bant
    ? Object.entries(ctx.checklistState.bant)
        .filter(([, v]) => v !== "unknown")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ")
    : "";

  const lines: string[] = [
    `Create a professional sales deck for ${ctx.accountName}.`,
    "",
    "Use the following customer pain points from the discovery call transcript:",
  ];

  if (pains.length > 0) {
    for (const p of pains) {
      lines.push(`- "${p}"`);
    }
  } else {
    lines.push("- (No specific pain points captured — use general discovery themes)");
  }

  if (bantStatus) {
    lines.push("", `BANT qualification status: ${bantStatus}`);
  }

  if (ctx.intentLabel) {
    lines.push(`Call intent: ${ctx.intentLabel}`);
  }

  lines.push(
    "",
    "The deck should include:",
    "1. Title slide with account name",
    "2. Customer challenges / pain points (from transcript)",
    "3. Proposed solution addressing each pain point",
    "4. Key differentiators",
    "5. ROI / business impact",
    "6. Next steps / call to action",
    "",
    "Make it visually clean with concise bullet points. Generate the slides now."
  );

  return lines.join("\n");
}

export async function createDeckFromCall(ctx: CallContext): Promise<string> {
  // 1. Create a Content Studio project
  const createRes = await fetch("/api/content/studio/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `${ctx.accountName} — Discovery Deck`,
      artifactType: "deck",
    }),
  });
  if (!createRes.ok) throw new Error("Failed to create studio project");
  const project = (await createRes.json()) as { id: string };

  // 2. Send the first message with pain points to auto-generate
  const prompt = buildDeckPrompt(ctx);
  const msgRes = await fetch(`/api/content/studio/projects/${project.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: prompt, generate: true }),
  });
  if (!msgRes.ok) {
    // Project created but generation failed — user can retry in studio
    return project.id;
  }

  return project.id;
}

export { extractPainPoints, buildDeckPrompt };
