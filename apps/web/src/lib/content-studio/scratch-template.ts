export type ScratchSlideLayout =
  | "cover"
  | "section"
  | "blank"
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
  textColor?: string;
  backgroundImageDataUrl?: string;
  backgroundImageUrl?: string;
  backgroundImageName?: string;
  /** When true the slide occupies a locked position (start or end group) and cannot be deleted or reordered. */
  isFixed?: boolean;
}

export interface ScratchLogoAsset {
  id: string;
  label: string;
  dataUrl: string;
  url?: string;
  fileName?: string;
  isPrimary?: boolean;
}

export type ScratchTemplateFont = "urbanist" | "inter" | "system" | "georgia" | "serif" | "mono";

export interface ScratchTemplateDraft {
  name: string;
  accentColor: string;
  textColor?: string;
  fontFamily?: ScratchTemplateFont;
  tags: string[];
  logos?: ScratchLogoAsset[];
  logoDataUrl?: string;
  logoName?: string;
  /** Fixed slides prepended before the user's editable slides. */
  fixedStartSlides?: ScratchSlideDraft[];
  /** User-editable slides in the middle of the template. */
  slides: ScratchSlideDraft[];
  /** Fixed slides appended after the user's editable slides. */
  fixedEndSlides?: ScratchSlideDraft[];
}

export const SCRATCH_LAYOUT_OPTIONS: Array<{ value: ScratchSlideLayout; label: string }> = [
  { value: "cover", label: "Cover" },
  { value: "section", label: "Section" },
  { value: "blank", label: "Blank" },
  { value: "two_column", label: "Two column" },
  { value: "three_cards", label: "Three cards" },
  { value: "visual_left", label: "Visual left" },
  { value: "quote", label: "Quote" },
  { value: "closing", label: "Closing" },
];

export const SCRATCH_FONT_OPTIONS: Array<{
  value: ScratchTemplateFont;
  label: string;
  css: string;
}> = [
  { value: "urbanist", label: "Urbanist", css: "Urbanist, Arial, sans-serif" },
  { value: "inter", label: "Inter", css: "Inter, Arial, sans-serif" },
  {
    value: "system",
    label: "System sans",
    css: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  { value: "georgia", label: "Georgia", css: 'Georgia, "Times New Roman", serif' },
  { value: "serif", label: "Editorial serif", css: 'Cambria, Georgia, "Times New Roman", serif' },
  { value: "mono", label: "Mono", css: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace' },
];

const DEFAULT_BACKGROUNDS = ["#ffffff", "#f8fafc", "#eff6ff", "#f0fdf4", "#fff7ed", "#111827"];

export function createScratchSlide(index: number, layout: ScratchSlideLayout = "cover"): ScratchSlideDraft {
  const isCover = index === 1 && layout === "cover";
  const isBlank = layout === "blank";
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${index}`,
    layout,
    title: isBlank ? "" : isCover ? "Executive Narrative" : `Slide ${index} title`,
    kicker: isBlank ? "" : isCover ? "Template" : `Slide ${index}`,
    body: isBlank
      ? ""
      : isCover
        ? "Use this skeleton as the starting point for generated sales content."
        : "Add the message, proof, and visual direction for this slide.",
    backgroundColor: DEFAULT_BACKGROUNDS[(index - 1) % DEFAULT_BACKGROUNDS.length],
  };
}

export function buildScratchTemplateDocument(draft: ScratchTemplateDraft): { html: string; css: string } {
  const accent = safeColor(draft.accentColor, "#2563eb");
  const defaultTextColor = safeColor(draft.textColor ?? "#0f172a", "#0f172a");
  const fontFamily = safeFontFamily(draft.fontFamily);
  const logos = normalizeLogos(draft);
  const logoCluster = logos.length > 0 ? buildLogoCluster(logos) : "";

  const allSlides = [
    ...(draft.fixedStartSlides ?? []),
    ...draft.slides,
    ...(draft.fixedEndSlides ?? []),
  ];

  const slides = allSlides.map((slide, index) =>
    buildSlideMarkup(slide, index + 1, logoCluster, defaultTextColor)
  );

  return {
    html: slides.join("\n"),
    css: buildScratchCss(accent, defaultTextColor, fontFamily),
  };
}

function makeFixedSlide(
  layout: ScratchSlideLayout,
  title: string,
  kicker: string,
  body: string,
  backgroundColor: string,
  textColor?: string
): ScratchSlideDraft {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `fixed-${Date.now()}-${Math.random()}`,
    layout,
    title,
    kicker,
    body,
    backgroundColor,
    textColor,
    isFixed: true,
  };
}

/**
 * Returns the single fixed cover slide that always opens every template.
 * The template creator can edit its content; it cannot be deleted or reordered.
 */
export function createDefaultFixedStartSlides(): ScratchSlideDraft[] {
  return [
    makeFixedSlide(
      "cover",
      "Slide Title",
      "EXECUTIVE BRIEFING",
      "A strategic overview prepared for [Prospect Name] — [Date]",
      "#0f172a",
      "#ffffff"
    ),
  ];
}

/**
 * Returns the 6 fixed closing slides that always end every template.
 * The template creator can edit their content; they cannot be deleted or reordered.
 */
export function createDefaultFixedEndSlides(): ScratchSlideDraft[] {
  return [
    makeFixedSlide(
      "section",
      "About [Company]",
      "OUR COMPANY",
      "Brief overview of who we are and why we're here.",
      "#f8fafc"
    ),
    makeFixedSlide(
      "three_cards",
      "Why [Company]?",
      "OUR DIFFERENTIATORS",
      "Three things that set us apart from the competition.",
      "#ffffff"
    ),
    makeFixedSlide(
      "visual_left",
      "Proven Results",
      "CUSTOMER SUCCESS",
      "Real outcomes from customers just like you.",
      "#eff6ff"
    ),
    makeFixedSlide(
      "two_column",
      "Investment Overview",
      "YOUR INVESTMENT",
      "Clear value and the return you can expect.",
      "#ffffff"
    ),
    makeFixedSlide(
      "closing",
      "Next Steps",
      "LET'S MOVE FORWARD",
      "Align on actions and timeline to get started today.",
      "#f0fdf4"
    ),
    makeFixedSlide(
      "cover",
      "Thank You",
      "WE'RE EXCITED TO PARTNER",
      "Questions? Let's keep the conversation going.",
      "#0f172a",
      "#ffffff"
    ),
  ];
}

export function parseScratchTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function buildSlideMarkup(
  slide: ScratchSlideDraft,
  slideNumber: number,
  logoCluster: string,
  defaultTextColor: string
): string {
  const bg = safeColor(slide.backgroundColor, "#ffffff");
  const textColor = safeColor(slide.textColor ?? defaultTextColor, defaultTextColor);
  const hasBackgroundImage = Boolean(slide.backgroundImageUrl || slide.backgroundImageDataUrl);
  const backgroundSrc = slide.backgroundImageUrl || slide.backgroundImageDataUrl || "";
  const backgroundImage = hasBackgroundImage
    ? `<img class="scratch-bg-image" src="${escapeAttr(backgroundSrc)}" alt="" />`
    : "";
  const classes = [
    "slide",
    "scratch-slide",
    `layout-${slide.layout}`,
    hasBackgroundImage ? "has-bg-image" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<section class="${classes}" data-slide="${slideNumber}" style="--slide-bg: ${bg}; --slide-text: ${textColor}; --slide-muted: ${textColor};">
  ${backgroundImage}
  ${logoCluster}
  ${buildLayoutBody(slide, slideNumber)}
</section>`;
}

function normalizeLogos(draft: ScratchTemplateDraft): ScratchLogoAsset[] {
  const logo = (draft.logos ?? []).find((entry) => Boolean(entry.url || entry.dataUrl));
  if (logo) return [logo];
  if (!draft.logoDataUrl) return [];
  return [
    {
      id: "logo",
      label: "Logo",
      dataUrl: draft.logoDataUrl,
      fileName: draft.logoName,
      isPrimary: true,
    },
  ];
}

function logoSrc(logo: ScratchLogoAsset): string {
  return logo.url || logo.dataUrl;
}

function buildLogoCluster(logos: ScratchLogoAsset[]): string {
  const logo = logos[0];
  if (!logo) return "";
  const src = logoSrc(logo);
  if (!src) return "";

  return `<div class="scratch-logo-cluster">
  <img class="scratch-logo-primary" src="${escapeAttr(src)}" alt="${escapeAttr(
    logo.fileName || logo.label || "Logo"
  )}" />
</div>`;
}

function buildLayoutBody(slide: ScratchSlideDraft, slideNumber: number): string {
  const kicker = escapeHtml(`Slide ${slideNumber}`);
  const title = escapeHtml(slide.title || `Slide ${slideNumber} title`);
  const body = escapeHtml(slide.body || "Add content here.");

  switch (slide.layout) {
    case "section":
      return `<div class="section-layout">
  <div class="section-main">
    <div class="section-marker">${String(slideNumber).padStart(2, "0")}</div>
    <div class="slide-copy">
      <div class="eyebrow">${kicker}</div>
      <h1>${title}</h1>
      <p>${body}</p>
    </div>
  </div>
  <div class="section-messages">
    <span>Message 01</span>
    <span>Message 02</span>
  </div>
</div>`;
    case "blank":
      return `<div class="blank-layout"></div>`;
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
  </div>`;
    case "cover":
    default:
      return `<div class="slide-copy cover-copy">
    <div class="eyebrow">${kicker}</div>
    <h1>${title}</h1>
    <p>${body}</p>
  </div>`;
  }
}

function buildScratchCss(accent: string, textColor: string, fontFamily: string): string {
  return `:root {
  --surface: #ffffff;
  --text: ${textColor};
  --muted: ${textColor};
  --border: #dbe3ec;
  --accent: ${accent};
}

body {
  margin: 0;
  background: #e5e7eb;
  color: var(--text);
  font-family: ${fontFamily};
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
  color: var(--slide-text, var(--text));
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
  background: transparent;
}

.scratch-bg-image {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  opacity: 1;
  object-fit: cover;
}

.scratch-logo-cluster {
  position: absolute;
  top: 34px;
  right: 42px;
  z-index: 2;
  display: flex;
  max-width: 230px;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}

.scratch-logo-primary {
  max-width: 164px;
  max-height: 56px;
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
  color: var(--slide-muted, var(--muted));
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

.proof-row {
  display: grid;
  gap: 14px;
}

.section-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(240px, 340px);
  gap: 48px;
  flex: 1;
  align-items: center;
  width: 100%;
}

.section-main {
  min-width: 0;
}

.section-messages {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.proof-row span,
.section-messages span,
.card-grid article,
.two-column-grid article,
.visual-slot {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255,255,255,0.72);
}

.proof-row span,
.section-messages span {
  padding: 18px 20px;
  color: var(--slide-text, var(--text));
  font-size: 18px;
  font-weight: 700;
}

.section-messages span {
  min-height: 132px;
  display: flex;
  align-items: center;
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
  margin-bottom: 12px;
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

.blank-layout {
  flex: 1;
  width: 100%;
  min-height: 100%;
}`;
}

function safeColor(value: string, fallback: string): string {
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : fallback;
}

function safeFontFamily(value?: ScratchTemplateFont): string {
  return SCRATCH_FONT_OPTIONS.find((option) => option.value === value)?.css ?? SCRATCH_FONT_OPTIONS[0].css;
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
