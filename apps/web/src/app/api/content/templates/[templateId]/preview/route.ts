import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl, internalApiHeaders } from "@/lib/api/internal-headers";
import { getInternalApiSecret } from "@/lib/public-env";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  try {
    const { templateId } = await params;
    const headers = await internalApiHeaders();
    const secret = getInternalApiSecret();
    const res = await fetch(`${apiBaseUrl()}/api/v1/content/templates/${templateId}/preview`, {
      headers: {
        ...headers,
        ...(secret ? { "X-Internal-Secret": secret } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return new NextResponse(await res.text(), { status: res.status });
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Unauthorized", { status: 401 });
  }
}
