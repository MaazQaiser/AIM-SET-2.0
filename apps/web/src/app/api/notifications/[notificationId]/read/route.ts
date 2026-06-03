import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { NextResponse } from "next/server";

interface Params {
  params: Promise<{ notificationId: string }>;
}

export async function PATCH(_req: Request, { params }: Params) {
  try {
    const headers = await internalApiHeaders();
    const { notificationId } = await params;
    const res = await fetch(`${apiBaseUrl()}/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers,
    });
    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
