import { NextResponse } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";

export async function POST(req: Request) {
  try {
    const headers = await internalApiHeaders();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new NextResponse("Missing file", { status: 400 });
    }
    const upstream = new FormData();
    upstream.append("file", file, file.name);
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/parent/assets`, {
      method: "POST",
      headers,
      body: upstream,
    });
    if (!res.ok) {
      return new NextResponse(await res.text(), { status: res.status });
    }
    return NextResponse.json(await res.json());
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
