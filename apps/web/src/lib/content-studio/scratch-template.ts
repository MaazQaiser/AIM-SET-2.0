export type ScratchSlideLayout =
  | "cover"
  | "section"
  | "two_column"
  | "three_cards"
  | "visual_left"
  | "quote"
  | "closing";

export interface ScratchSlideDraft {
  id: string;
  layout: ScratchSlideLayout;
  title: string;
  kicker: string;
  body: string;
  backgroundColor: string;
  backgroundImageDataUrl?: string;
  backgroundImageName?: string;
}

export interface ScratchTemplateDraft {
  name: string;
  accentColor: string;
  tags: string[];
  logoDataUrl?: string;
  logoName?: string;
  slides: ScratchSlideDraft[];
}

export const SCRATCH_LAYOUT_OPTIONS: Array<{ value: ScratchSlideLayout; label: string }> = [
  { value: "cover", label: "Cover" },
  { value: "section", label: "Section" },
  { value: "two_column", label: "Two column" },
  { value: "three_cards", label: "Three cards" },
  { value: "visual_left", label: "Visual left" },
  { value: "quote", label: "Quote" },
  { value: "closing", label: "Closing" },
];

const DEFAULT_BACKGROUNDS = ["#ffffff", "#f8fafc", "#eff6ff", "#f0fdf4", "#fff7ed", "#111827"];

export function createScratchSlide(index: number, layout: ScratchSlideLayout = "cover"): ScratchSlideDraft {
  const isCover = index === 1;
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}`,
    layout,
    title: isCover ? "Executive Narrative" : `Slide ${index} title`,
    kicker: isCover ? "Template" : `Slide ${index}`,
    body: isCover
      ? "Use this skeleton as the starting point for generated sales content."
      : "Add the message, proof, and visual direction for this slide.",
    backgroundColor: DEFAULT_BACKGROUNDS[(index - 1) % DEFAULT_BACKGROUNDS.length],
  };
}

export function buildScratchTemplateDocument(draft: ScratchTemplateDraft): { html: string; css: string } {
  const accent = safeColor(draft.accentColor, "#2563eb");
  const logo = draft.logoDataUrl
    ? `<img class="scratch-logo" src="${escapeAttr(draft.logoDataUrl)}" alt="${escapeAttr(
        draft.logoName || "Logo"
      )}" />`
    : "";

  const slides = draft.slides.map((slide, index) => buildSlideMarkup(slide, index + 1, logo));

  return {
    html: slides.join("\n"),
    css: buildScratchCss(accent),
  };
}

export function parseScratchTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildSlideMarkup(slide: ScratchSlideDraft, slideNumber: number, logo: string): string {
  const bg = safeColor(slide.backgroundColor, "#ffffff");
  const hasBackgroundImage = Boolean(slide.backgroundImageDataUrl);
  const backgroundImage = hasBackgroundImage
    ? `<img class="scratch-bg-image" src="${escapeAttr(slide.backgroundImageDataUrl ?? "")}" alt="" />`
    : "";
  const classes = [
    "slide",
    "scratch-slide",
    `layout-${slide.layout}`,
    hasBackgroundImage ? "has-bg-image" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<section class="${classes}" data-slide="${slideNumber}" style="--slide-bg: ${bg};">
  ${backgroundImage}
  ${logo}
  ${buildLayoutBody(slide, slideNumber)}
</section>`;
}

function buildLayoutBody(slide: ScratchSlideDraft, slideNumber: number): string {
  const kicker = escapeHtml(slide.kicker || `Slide ${slideNumber}`);
  const title = escapeHtml(slide.title || `Slide ${slideNumber} title`);
  const body = escapeHtml(slide.body || "Add content here.");

  switch (slide.layout) {
    case "section":
      return `<div class="section-marker">${String(slideNumber).padStart(2, "0")}</div>
  <div class="slide-copy">
    <div class="eyebrow">${kicker}</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
  <div class="anchor-block">
    <span>Message</span>
    <span>Evidence</span>
    <span>Next action</span>
  </div>`;
    case "two_column":
      return `<header class="slide-header">
    <div class="eyebrow">${kicker}</div>
    <h2>${title}</h2>
    <p>${body}</p>
  </header>
  <div class="two-column-grid">
    <article>
      <span class="slot-label">Left content</span>
      <h3>Current state</h3>
      <p>Frame the issue, risk, or operational friction.</p>
    </article>
    <article>
      <span class="slot-label">Right content</span>
      <h3>Future state</h3>
      <p>Show the recommended path and measurable impact.</p>
    </article>
  </div>`;
    case "three_cards":
      return `<header class="slide-header">
    <div class="eyebrow">${kicker}</div>
    <h2>${title}</h2>
    <p>${body}</p>
  </header>
  <div class="card-grid">
    <article><strong>01</strong><h3>Problem</h3><p>Add buyer-specific friction.</p></article>
    <article><strong>02</strong><h3>Approach</h3><p>Add the recommended motion.</p></article>
    <article><strong>03</strong><h3>Outcome</h3><p>Add the measurable business result.</p></article>
  </div>`;
    case "visual_left":
      return `<div class="visual-grid">
    <figure class="visual-slot">
      <span>Visual</span>
    </figure>
    <div class="slide-copy">
      <div class="eyebrow">${kicker}</div>
      <h2>${title}</h2>
      <p>${body}</p>
      <div class="proof-row"><span>Proof point</span><span>Metric</span></div>
    </div>
  </div>`;
    case "quote":
      return `<div class="quote-layout">
    <div class="eyebrow">${kicker}</div>
    <blockquote>${title}</blockquote>
    <p>${body}</p>
    <div class="quote-source">Customer proof / stakeholder voice</div>
  </div>`;
    case "closing":
      return `<div class="slide-copy closing-copy">
    <div class="eyebrow">${kicker}</div>
    <h2>${title}</h2>
    <p>${body}</p>
  </div>
  <ol class="step-list">
    <li><span>1</span>Confirm priority use case</li>
    <li><span>2</span>Align stakeholders</li>
    <li><span>3</span>Approve next action</li>
  </ol>`;
    case "cover":
    default:
      return `<div class="slide-copy cover-copy">
    <div class="eyebrow">${kicker}</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>
  <div class="meta-row">
    <span>Audience</span>
    <span>Objective</span>
    <span>Timeline</span>
  </div>`;
  }
}

function buildScratchCss(accent: string): string {
  return `:root {
  --surface: #ffffff;
  --text: #0f172a;
  --muted: #64748b;
  --border: #dbe3ec;
  --accent: ${accent};
}

body {
  margin: 0;
  background: #e5e7eb;
  color: var(--text);
  font-family: Urbanist, Arial, sans-serif;
}

.scratch-slide {
  position: relative;
  box-sizing: border-box;
  width: 1280px;
  min-height: 720px;
  margin: 0 auto;
  padding: 56px;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: var(--slide-bg, var(--surface));
}

.scratch-slide::before {
  position: absolute;
  inset: 0;
  z-index: -1;
  content: "";
  background: linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.72));
}

.scratch-slide.has-bg-image::before {
  background: linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,0.74) 58%, rgba(255,255,255,0.28));
}

.scratch-bg-image {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scratch-logo {
  position: absolute;
  top: 34px;
  right: 42px;
  z-index: 2;
  max-width: 148px;
  max-height: 54px;
  object-fit: contain;
}

.eyebrow,
.slot-label,
.section-marker {
  color: var(--accent);
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
}

.eyebrow {
  margin-bottom: 18px;
}

h1,
h2,
h3,
p,
blockquote {
  margin: 0;
}

h1 {
  max-width: 840px;
  font-size: 64px;
  line-height: 1.02;
}

h2 {
  max-width: 820px;
  font-size: 48px;
  line-height: 1.08;
}

h3 {
  font-size: 24px;
  line-height: 1.16;
}

p,
li {
  color: var(--muted);
  font-size: 21px;
  line-height: 1.45;
}

.slide-copy p,
.slide-header p {
  max-width: 720px;
  margin-top: 20px;
}

.cover-copy {
  margin-top: 72px;
}

.meta-row,
.anchor-block,
.proof-row {
  display: grid;
  gap: 14px;
}

.meta-row {
  grid-template-columns: repeat(3, 1fr);
}

.meta-row span,
.anchor-block span,
.proof-row span,
.step-list li,
.card-grid article,
.two-column-grid article,
.visual-slot {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
}

.meta-row span,
.anchor-block span,
.proof-row span {
  padding: 18px 20px;
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
}

.slide-header {
  display: grid;
  gap: 8px;
}

.card-grid,
.two-column-grid,
.visual-grid {
  display: grid;
  gap: 20px;
  margin-top: 36px;
}

.card-grid {
  grid-template-columns: repeat(3, 1fr);
}

.two-column-grid,
.visual-grid {
  grid-template-columns: repeat(2, 1fr);
}

.card-grid article,
.two-column-grid article {
  min-height: 190px;
  padding: 24px;
}

.card-grid strong {
  display: block;
  margin-bottom: 16px;
  color: var(--accent);
  font-size: 32px;
}

.card-grid p,
.two-column-grid p {
  margin-top: 12px;
  font-size: 18px;
}

.visual-grid {
  align-items: center;
  min-height: 600px;
}

.visual-slot {
  min-height: 430px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
  font-size: 28px;
  font-weight: 800;
}

.proof-row {
  grid-template-columns: repeat(2, 1fr);
  margin-top: 34px;
}

.section-marker {
  font-size: 96px;
  line-height: 1;
  opacity: 0.16;
}

.anchor-block {
  grid-template-columns: repeat(3, 1fr);
}

.quote-layout {
  max-width: 930px;
  margin: auto 0;
}

blockquote {
  font-size: 58px;
  line-height: 1.08;
  font-weight: 800;
}

.quote-layout p {
  margin-top: 26px;
}

.quote-source {
  margin-top: 36px;
  color: var(--accent);
  font-size: 18px;
  font-weight: 800;
}

.closing-copy {
  max-width: 780px;
}

.step-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  padding: 0;
  list-style: none;
}

.step-list li {
  min-height: 120px;
  padding: 22px;
  color: var(--text);
  font-weight: 700;
}

.step-list span {
  display: block;
  margin-bottom: 14px;
  color: var(--accent);
  font-size: 28px;
}`;
}

function safeColor(value: string, fallback: string): string {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
