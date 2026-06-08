import { type NextRequest, NextResponse } from "next/server";

const apiBaseUrl = () => process.env.API_URL ?? "http://localhost:8000";

interface Params {
  params: Promise<{ token: string; assetId: string; assetPath: string[] }>;
}

const ALLOWED_PUBLIC_ASSET_PATHS = new Set(["file", "preview", "preview/slides"]);

function isAllowedAssetPath(path: string) {
  return ALLOWED_PUBLIC_ASSET_PATHS.has(path) || /^preview\/slides\/[1-9]\d*$/.test(path);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { token, assetId, assetPath } = await params;
  const path = assetPath.join("/");
  if (!isAllowedAssetPath(path)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstreamUrl = new URL(
    `${apiBaseUrl()}/api/v1/public/clp/${encodeURIComponent(token)}/assets/${encodeURIComponent(
      assetId
    )}/${path}`
  );
  upstreamUrl.search = req.nextUrl.search;

  const res = await fetch(upstreamUrl, { cache: "no-store" });
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      ...(res.headers.get("content-disposition")
        ? { "Content-Disposition": res.headers.get("content-disposition") as string }
        : {}),
      "Cache-Control": res.headers.get("cache-control") ?? "private, max-age=300",
    },
  });
}
