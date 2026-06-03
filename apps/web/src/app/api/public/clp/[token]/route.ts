import { NextResponse, type NextRequest } from "next/server";

const apiBaseUrl = () => process.env.API_URL ?? "http://localhost:8000";

interface Params {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const chat = req.nextUrl.searchParams.get("chat");
  const visitorId = req.nextUrl.searchParams.get("visitorId") ?? "";
  if (chat === "1" && visitorId) {
    const res = await fetch(
      `${apiBaseUrl()}/api/v1/public/clp/${encodeURIComponent(token)}/chat?visitorId=${encodeURIComponent(visitorId)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return NextResponse.json([], { status: res.status });
    return NextResponse.json(await res.json());
  }
  const res = await fetch(`${apiBaseUrl()}/api/v1/public/clp/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const body = await req.json();
  const path = body.action as string;
  let url = `${apiBaseUrl()}/api/v1/public/clp/${encodeURIComponent(token)}`;
  if (path === "auth") url += "/auth";
  else if (path === "identify") url += "/identify";
  else if (path === "events") url += "/events";
  else if (path === "chat") url += "/chat";
  else if (path === "comments") url += "/comments";
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body.payload ?? body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: res.status });
  return NextResponse.json(await res.json());
}
