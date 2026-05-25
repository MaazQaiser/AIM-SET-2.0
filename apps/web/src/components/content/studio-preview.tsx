"use client";

export function StudioPreview({ html }: { html?: string }) {
  if (!html) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Preview will appear after the agent generates HTML.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[400px] rounded-lg border border-border overflow-hidden bg-white">
      <iframe
        title="Content preview"
        srcDoc={previewDocument(html)}
        sandbox="allow-same-origin"
        className="h-full min-h-[480px] w-full border-0 bg-white"
      />
    </div>
  );
}

function previewDocument(html: string): string {
  const previewCss = `
    <style>
      html, body {
        margin: 0 !important;
        min-height: 100% !important;
        background: #e8eef7 !important;
      }
      body {
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }
      section.slide,
      .slide {
        width: min(100%, 1080px) !important;
        max-width: calc(100vw - 32px) !important;
        height: auto !important;
        min-height: auto !important;
        aspect-ratio: 16 / 9 !important;
        box-sizing: border-box !important;
      }
      img,
      svg,
      canvas,
      video {
        max-width: 100% !important;
      }
    </style>
  `;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${previewCss}</head>`);
  }

  return `<html><head>${previewCss}</head><body>${html}</body></html>`;
}
