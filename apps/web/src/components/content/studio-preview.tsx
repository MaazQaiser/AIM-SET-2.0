"use client";

import { useMemo } from "react";

export function StudioPreview({ html }: { html?: string }) {
  const srcDoc = useMemo(() => (html ? previewDocument(html) : undefined), [html]);

  if (!html) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Preview will appear after the agent generates HTML.
      </div>
    );
  }

  return (
    <div className="h-full min-h-[480px] rounded-lg border border-border overflow-hidden bg-[#1e1e2e]">
      <iframe
        title="Content preview"
        srcDoc={srcDoc}
        sandbox="allow-same-origin allow-scripts"
        className="h-full min-h-[480px] w-full border-0"
        style={{ background: "#1a1a2e" }}
      />
    </div>
  );
}

function previewDocument(html: string): string {
  // The scaling script runs inside the iframe and sets a CSS variable --scale
  // based on the actual iframe width, then CSS uses it to transform slides.
  // This keeps every font, position, padding, and image exactly as the
  // template designer intended — only the overall size changes.
  const scaleScript = `
    <script>
      (function() {
        var SLIDE_W = 1280, SLIDE_H = 720, GAP = 12, PAD = 16;
        function applyScale() {
          var available = document.documentElement.clientWidth - PAD * 2;
          var s = available / SLIDE_W;
          document.documentElement.style.setProperty('--preview-scale', String(s));
          // Each slide still occupies SLIDE_H in layout; we pull the next slide
          // up by the amount the visual height shrinks.
          var marginBottom = (s - 1) * SLIDE_H + GAP;
          document.documentElement.style.setProperty('--preview-mb', marginBottom + 'px');
        }
        applyScale();
        window.addEventListener('resize', applyScale);
      })();
    </script>
  `;

  const previewCss = `
    <style>
      html {
        margin: 0 !important;
        background: #1a1a2e !important;
      }
      body {
        margin: 0 !important;
        padding: 16px !important;
        background: #1a1a2e !important;
        box-sizing: border-box !important;
        overflow-x: hidden !important;
      }

      /* Override flex wrapper so slides stack vertically in block layout */
      body > div,
      body > .deck-preview {
        display: block !important;
      }

      /*
       * Scale each slide proportionally from the top-left corner so every
       * internal font size, position, padding, and image remains pixel-perfect
       * relative to the original 1280×720 design.
       * --preview-scale is set dynamically by the inline script above.
       */
      section.slide,
      .slide,
      .scratch-slide {
        display: block !important;
        width: 1280px !important;
        max-width: unset !important;
        height: 720px !important;
        min-height: unset !important;
        aspect-ratio: unset !important;
        transform-origin: top left !important;
        transform: scale(var(--preview-scale, 0.45)) !important;
        /* Pull the next slide up to eliminate the dead space below */
        margin-bottom: var(--preview-mb, -384px) !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        border-radius: 4px !important;
        flex-shrink: 0 !important;
      }

      img, svg, canvas, video {
        max-width: 100% !important;
      }
    </style>
  `;

  const injection = scaleScript + previewCss;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${injection}</head>`);
  }

  return `<html><head>${injection}</head><body>${html}</body></html>`;
}
