import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function POST(req: Request) {
  try {
    const headers = await internalApiHeaders();
    const form = await req.formData();
    const upstream = new FormData();
    const file = form.get("file");
    if (file) upstream.append("file", file);
    const name = form.get("name");
    if (name) upstream.append("name", String(name));
    const artifactType = form.get("artifactType");
    if (artifactType) upstream.append("artifact_type", String(artifactType));
    const tags = form.get("tags");
    if (tags) upstream.append("tags", String(tags));

    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/upload`, {
      method: "POST",
      headers,
      body: upstream,
    });
    if (!res.ok) {
      const err = await res.text();
      return new NextResponse(err || "Upstream error", { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
