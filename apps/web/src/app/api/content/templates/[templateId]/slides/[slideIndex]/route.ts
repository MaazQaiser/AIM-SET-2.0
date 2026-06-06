import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { getInternalApiSecret } from "@/lib/public-env";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string; slideIndex: string }> }
) {
  try {
    const { templateId, slideIndex } = await params;
    const headers = await internalApiHeaders();
    const secret = getInternalApiSecret();
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/content/templates/${templateId}/slides/${slideIndex}`,
      {
        headers: {
          ...headers,
          ...(secret ? { "X-Internal-Secret": secret } : {}),
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      return new NextResponse(await res.text(), { status: res.status });
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
