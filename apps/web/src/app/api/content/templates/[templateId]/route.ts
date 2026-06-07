import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function GET(_req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/${templateId}`, {
      headers,
    });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const headers = await internalApiHeaders();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/${templateId}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) return new NextResponse("Upstream error", { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ templateId: string }> }) {
  try {
    const { templateId } = await params;
    const headers = await internalApiHeaders();
    const body = await req.json();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/${templateId}`, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Recover gracefully if the template ID is stale/missing:
    // create a new template from the current editor payload instead of failing save.
    if (res.status === 404) {
      const createRes = await fetch(`${apiBaseUrl()}/api/v1/content/templates`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!createRes.ok) {
        const createErr = await createRes.text();
        return new NextResponse(createErr || "Upstream error", { status: createRes.status });
      }
      return NextResponse.json(await createRes.json());
    }
    if (!res.ok) {
      const err = await res.text();
      return new NextResponse(err || "Upstream error", { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
