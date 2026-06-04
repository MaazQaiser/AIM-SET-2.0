export const TEMPLATE_ARTIFACT_TYPES = [
  { value: "deck", label: "Deck" },
  { value: "one_pager", label: "One pager" },
  { value: "image", label: "Image" },
] as const;

export type TemplateArtifactType = (typeof TEMPLATE_ARTIFACT_TYPES)[number]["value"];

export const STARTER_TEMPLATE_HTML = `<section class="slide template-root" data-slide="1">
  <div class="eyebrow">Template</div>
  <h1>Executive Narrative</h1>
  <p>Use this layout as a reusable structure for generated content.</p>
  <div class="grid">
    <article class="card">
      <h2>Problem</h2>
      <p>Frame the current state.</p>
    </article>
    <article class="card">
      <h2>Approach</h2>
      <p>Show the recommended path.</p>
    </article>
    <article class="card">
      <h2>Outcome</h2>
      <p>Make the business impact clear.</p>
    </article>
  </div>
</section>`;

export const STARTER_TEMPLATE_CSS = `:root {
  --bg: #f8fafc;
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --accent: #2563eb;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Urbanist, Arial, sans-serif;
}

.slide {
  box-sizing: border-box;
  width: 1280px;
  min-height: 720px;
  margin: 0 auto;
  padding: 56px;
  background: var(--surface);
}

.eyebrow {
  color: var(--accent);
  font-size: 14px;
  font-weight: 700;
}

h1 {
  max-width: 760px;
  margin: 18px 0;
  font-size: 58px;
  line-height: 1.02;
}

p {
  color: var(--muted);
  font-size: 22px;
  line-height: 1.45;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  margin-top: 42px;
}

.card {
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  background: #f8fafc;
}

.card h2 {
  margin: 0 0 8px;
  font-size: 24px;
}

.card p {
  margin: 0;
  font-size: 17px;
}`;

export function splitTemplateDocument(rawHtml: string): { html: string; css: string } {
  let value = rawHtml?.trim() ?? "";
  if (!value) return { html: STARTER_TEMPLATE_HTML, css: STARTER_TEMPLATE_CSS };

  value = value
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const styles = [...value.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
  const withoutStyles = value.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();
  const bodyMatch = withoutStyles.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let html = (bodyMatch?.[1] ?? withoutStyles).trim();
  html = html
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head)[^>]*>/gi, "")
    .trim();

  return {
    html: html || STARTER_TEMPLATE_HTML,
    css: styles.join("\n\n") || STARTER_TEMPLATE_CSS,
  };
}

export function compileTemplateDocument(html: string, css: string): string {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    "<style>",
    css,
    "</style>",
    "</head>",
    `<body>${html}</body>`,
    "</html>",
  ].join("");
}

export function parseTemplateTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
