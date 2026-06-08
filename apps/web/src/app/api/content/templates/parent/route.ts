import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

/** Tag used to identify the singleton parent template record. */
const PARENT_TAG = "__parent_template__";

interface RawTemplate {
  id: string;
  name: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

async function findParent(headers: HeadersInit): Promise<RawTemplate | null> {
  const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/parent`, { headers });
  if (!res.ok) return null;
  const parent = (await res.json()) as RawTemplate | null;
  return parent ?? null;
}

/** GET — returns the parent template record (or null if not yet configured). */
export async function GET() {
  try {
    const headers = await internalApiHeaders();
    const parent = await findParent(headers);
    return NextResponse.json(parent ?? null);
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

/** PUT — creates or updates the parent template. */
export async function PUT(req: Request) {
  try {
    const headers = await internalApiHeaders();
    const body = (await req.json()) as Record<string, unknown>;

    const incomingTags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      : [];
    const payload = {
      ...body,
      tags: Array.from(new Set([PARENT_TAG, ...incomingTags])),
      metadata: {
        ...((body.metadata as Record<string, unknown> | undefined) ?? {}),
        isParentTemplate: true,
      },
    };

    const existing = await findParent(headers);

    if (existing) {
      const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/${existing.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Auto-recover from stale parent IDs:
      // if the parent was deleted/missing between lookup and patch, create it.
      if (res.status === 404) {
        const createRes = await fetch(`${apiBaseUrl()}/api/v1/content/templates`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!createRes.ok) return new NextResponse(await createRes.text(), { status: createRes.status });
        return NextResponse.json(await createRes.json());
      }
      if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
      return NextResponse.json(await res.json());
    }

    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return new NextResponse(await res.text(), { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
