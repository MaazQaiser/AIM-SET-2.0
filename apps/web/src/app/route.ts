import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ASSET_REWRITES: Array<[RegExp, string]> = [
  [/src:\s*['"]logo\.png['"]/g, "src: '/fullsphere/logo.png'"],
  [/src:\s*['"]hero-screenshot\.png['"]/g, "src: '/fullsphere/hero-screenshot.png'"],
  [/url\(\s*['"]?hero-bg\.png['"]?\s*\)/g, "url(/fullsphere/hero-bg.png)"],
  [/src="logo\.png"/g, 'src="/fullsphere/logo.png"'],
  [/src="hero-screenshot\.png"/g, 'src="/fullsphere/hero-screenshot.png"'],
];

function loadLandingHtml(): string {
  let html = readFileSync(
    path.join(process.cwd(), "public/fullsphere/index.html"),
    "utf8"
  );

  for (const [pattern, replacement] of ASSET_REWRITES) {
    html = html.replace(pattern, replacement);
  }

  return html;
}

export function GET() {
  return new NextResponse(loadLandingHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
