# DC Copilot Design System
**Version:** 0.1
**Stack:** Next.js 16 · Tailwind CSS v4 · shadcn/ui · Inter
**Primary Color:** Blue
**Last updated:** May 2026

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Color Tokens](#2-color-tokens)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Border Radius & Elevation](#5-border-radius--elevation)
6. [Component Inventory](#6-component-inventory)
7. [Component API Reference](#7-component-api-reference)
8. [Do / Don't Guidelines](#8-do--dont-guidelines)
9. [Accessibility Standards](#9-accessibility-standards)
10. [Dark Mode](#10-dark-mode)
11. [Figma Token Mapping](#11-figma-token-mapping)

---

## 1. Design Principles

| Principle | What it means in practice |
|---|---|
| **Clarity first** | Every element earns its place. No decoration for decoration's sake. |
| **Evidence is primary** | AI-generated content is always labelled and cited. Users know what the machine said and why. |
| **Density without clutter** | The leadership dashboard must be scannable in 30 seconds. Use information hierarchy, not whitespace inflation. |
| **Accessible by default** | WCAG 2.2 AA minimum on every component, every mode. The app is used on iPad in meetings. |
| **Responsive, not rearranged** | Components respond to viewport; they do not break at 1024px. |

---

## 2. Color Tokens

All tokens are declared as HSL triplets (no `hsl()` wrapper) in `globals.css` and consumed via Tailwind's CSS variable bridging. **Never use raw hex values in components.**

### 2.1 Semantic Tokens — Light Mode

```css
:root {
  /* ── Core ── */
  --background:        0   0%  100%;   /* white page background */
  --foreground:      222  47%  11%;    /* slate-900 body text */

  /* ── Primary (Blue) ── */
  --primary:         221  83%  53%;    /* blue-600 — CTAs, active nav */
  --primary-foreground: 210 40% 98%;  /* near-white — text on primary bg */

  /* ── Secondary ── */
  --secondary:       217  91%  60%;    /* blue-500 — secondary actions */
  --secondary-foreground: 222 47% 11%; /* slate-900 */

  /* ── Accent ── */
  --accent:          214  95%  93%;    /* blue-100 — hover bg, tag fills */
  --accent-foreground: 221 83% 36%;   /* blue-800 */

  /* ── Muted ── */
  --muted:           210  40%  96%;    /* slate-100 — muted section bg */
  --muted-foreground: 215 16%  47%;   /* slate-500 — captions, placeholders */

  /* ── Card ── */
  --card:            0   0%  100%;
  --card-foreground: 222  47%  11%;

  /* ── Popover ── */
  --popover:         0   0%  100%;
  --popover-foreground: 222 47% 11%;

  /* ── Border & Input ── */
  --border:          214  32%  91%;    /* slate-200 */
  --input:           214  32%  91%;
  --ring:            221  83%  53%;    /* blue-600 focus ring */

  /* ── Semantic Status ── */
  --destructive:      0   72%  51%;    /* red-600 */
  --destructive-foreground: 0 0% 98%;
  --success:         142  71%  45%;    /* green-600 */
  --success-foreground: 0 0% 98%;
  --warning:          38  92%  50%;    /* amber-500 */
  --warning-foreground: 26 90% 15%;

  /* ── Live Call Specific ── */
  --live:            152  82%  39%;    /* emerald-600 — live indicator */
  --live-foreground: 0   0%  98%;
  --nudge:            38  92%  50%;    /* amber-500 — proactive nudge */
  --nudge-foreground: 26 90% 15%;

  /* ── Radius ── */
  --radius: 0.5rem;                    /* 8px base, cards 12px, modal 16px */
}
```

### 2.2 Semantic Tokens — Dark Mode

```css
.dark {
  --background:      222  47%   8%;    /* near-black */
  --foreground:      210  40%  98%;    /* near-white */

  --primary:         213  94%  68%;    /* blue-400 (lighter for dark bg) */
  --primary-foreground: 222 47% 8%;

  --secondary:       217  91%  55%;
  --secondary-foreground: 0 0% 98%;

  --accent:          217  33%  17%;    /* dark blue-tinted hover */
  --accent-foreground: 210 40% 98%;

  --muted:           217  33%  17%;
  --muted-foreground: 215 20%  65%;

  --card:            222  47%  11%;
  --card-foreground: 210  40%  98%;

  --popover:         222  47%  11%;
  --popover-foreground: 210 40% 98%;

  --border:          217  33%  25%;
  --input:           217  33%  25%;
  --ring:            213  94%  68%;

  --destructive:      0   63%  51%;
  --destructive-foreground: 0 0% 98%;
  --success:         142  60%  40%;
  --success-foreground: 0 0% 98%;
  --warning:          38  85%  55%;
  --warning-foreground: 26 90% 10%;

  --live:            152  70%  45%;
  --live-foreground: 0   0%   6%;
  --nudge:            38  85%  55%;
  --nudge-foreground: 26 90% 10%;
}
```

### 2.3 Full Blue Palette Reference

| Scale | Hex | HSL | Usage |
|---|---|---|---|
| blue-50 | `#EFF6FF` | `214 100% 97%` | Lightest highlight, hover chips |
| blue-100 | `#DBEAFE` | `214 95% 93%` | Tag fills, accent backgrounds |
| blue-200 | `#BFDBFE` | `213 97% 87%` | — |
| blue-300 | `#93C5FD` | `212 97% 78%` | — |
| blue-400 | `#60A5FA` | `213 94% 68%` | Dark mode primary |
| blue-500 | `#3B82F6` | `217 91% 60%` | Secondary actions |
| **blue-600** | **`#2563EB`** | **`221 83% 53%`** | **Primary — CTAs, active nav** |
| blue-700 | `#1D4ED8` | `224 76% 48%` | Primary hover |
| blue-800 | `#1E40AF` | `226 71% 40%` | Primary pressed |
| blue-900 | `#1E3A8A` | `226 57% 33%` | Darkest, display text on light |

### 2.4 Neutral Slate Reference

| Scale | Usage |
|---|---|
| slate-50 | Lightest page bg variant |
| slate-100 | `--muted` light |
| slate-200 | `--border` light |
| slate-400 | Disabled text |
| slate-500 | `--muted-foreground` |
| slate-700 | Secondary text, dark labels |
| slate-900 | `--foreground` light |

---

## 3. Typography

### Font Stack

```css
--font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', ui-monospace, monospace;
```

Load Inter via `next/font/google` with `subsets: ['latin']` and `display: 'swap'`.

### Type Scale

| Token | Size | Line height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 12px | 1.5 | 400 | Captions, timestamps, legal |
| `text-sm` | 14px | 1.5 | 400 | Body secondary, table rows |
| `text-base` | 16px | 1.625 | 400 | Body primary |
| `text-lg` | 18px | 1.75 | 500 | Section leads, card titles |
| `text-xl` | 20px | 1.75 | 600 | Page sub-headings |
| `text-2xl` | 24px | 1.33 | 600 | Page headings |
| `text-3xl` | 30px | 1.33 | 700 | Dashboard hero metrics |
| `text-4xl` | 36px | 1.1 | 700 | Display (auth page, empty states) |

### Weight Usage

| Weight | Token | When |
|---|---|---|
| 400 | `font-normal` | Body text, table data |
| 500 | `font-medium` | Labels, buttons, nav items |
| 600 | `font-semibold` | Headings h2–h4, card titles |
| 700 | `font-bold` | h1, metric numbers, hero display |

### Text Color Hierarchy

```
foreground (slate-900)      → primary body text
muted-foreground (slate-500) → captions, metadata, helper text
primary (blue-600)           → links, active states
destructive (red-600)        → errors
```

---

## 4. Spacing & Layout

### Base Unit

Tailwind's 4px grid. All spacing is multiples of 4px.

### Component Spacing Guide

| Context | Value | Tailwind |
|---|---|---|
| Inline button padding | 8 × 12px | `py-2 px-3` |
| Standard button padding | 8 × 16px | `py-2 px-4` |
| Card internal padding | 16–24px | `p-4` or `p-6` |
| Page section gap | 24px | `gap-6` |
| Between major page sections | 32px | `gap-8` or `space-y-8` |
| Sidebar width | 240px | `w-60` |
| Sidebar collapsed | 64px | `w-16` |
| Header height | 56px | `h-14` |
| Live call header | 48px | `h-12` |

### Breakpoints

| Breakpoint | Width | Primary target |
|---|---|---|
| base | 0–767px | Mobile (375px test) |
| `md` | 768px | Tablet (768px test) |
| `lg` | 1024px | iPad landscape, minimum desktop |
| `xl` | 1280px | Standard desktop |
| `2xl` | 1536px | Large desktop |

> The leadership dashboard must be fully usable at `lg` (1024px). Test every layout at this breakpoint.

---

## 5. Border Radius & Elevation

### Border Radius

| Token | Value | Usage |
|---|---|---|
| `rounded-sm` | 4px | Badges, chips, small tags |
| `rounded-md` | 6px | Buttons, inputs |
| `rounded-lg` | 8px | Cards, dropdowns |
| `rounded-xl` | 12px | Modals, drawers |
| `rounded-2xl` | 16px | Hero cards, feature panels |
| `rounded-full` | 9999px | Avatars, status dots |

### Shadow / Elevation

| Level | Usage | Tailwind |
|---|---|---|
| 0 | Flat — inputs, table rows | `shadow-none` |
| 1 | Cards on bg | `shadow-sm` |
| 2 | Dropdowns, popovers | `shadow-md` |
| 3 | Modals, drawers | `shadow-xl` |
| 4 | Toasts | `shadow-2xl` |

---

## 6. Component Inventory

### 6.1 Primitives (`packages/ui/src/`)

| Component | File | shadcn base | Notes |
|---|---|---|---|
| `Button` | `button.tsx` | `button` | 6 variants + size + loading |
| `Input` | `input.tsx` | `input` | — |
| `Textarea` | `textarea.tsx` | `textarea` | Auto-resize variant |
| `Label` | `label.tsx` | `label` | — |
| `Select` | `select.tsx` | `select` | — |
| `Combobox` | `combobox.tsx` | `command` + `popover` | Searchable |
| `Badge` | `badge.tsx` | `badge` | 7 variants |
| `Avatar` | `avatar.tsx` | `avatar` | Fallback initials |
| `Skeleton` | `skeleton.tsx` | `skeleton` | — |
| `Spinner` | `spinner.tsx` | — | Custom |
| `Separator` | `separator.tsx` | `separator` | — |
| `Switch` | `switch.tsx` | `switch` | — |
| `Checkbox` | `checkbox.tsx` | `checkbox` | — |
| `RadioGroup` | `radio-group.tsx` | `radio-group` | — |
| `Slider` | `slider.tsx` | `slider` | Cost cap control |

### 6.2 Layout / Overlay

| Component | File | Notes |
|---|---|---|
| `Card` | `card.tsx` | Header / Content / Footer |
| `Dialog` | `dialog.tsx` | Focus trap, Esc close |
| `Sheet` | `sheet.tsx` | Side drawer (KB detail, citation) |
| `Popover` | `popover.tsx` | Citation popover |
| `Tooltip` | `tooltip.tsx` | — |
| `DropdownMenu` | `dropdown-menu.tsx` | — |
| `Tabs` | `tabs.tsx` | Underline + pill variants |
| `Toast` | `sonner.tsx` | via sonner |
| `AlertDialog` | `alert-dialog.tsx` | Destructive confirmations |

### 6.3 Data Display

| Component | File | Notes |
|---|---|---|
| `DataTable` | `data-table.tsx` | TanStack Table v8 |
| `EmptyState` | `empty-state.tsx` | Icon + message + CTA |
| `StatCard` | `stat-card.tsx` | Metric display (dashboard) |

### 6.4 App-Specific (`apps/web/src/components/`)

| Component | File | Phase |
|---|---|---|
| `CallCard` | `call-card.tsx` | D1 |
| `BANTScorecard` | `bant-scorecard.tsx` | D1 |
| `PodMemberBadge` | `pod-member-badge.tsx` | D1 |
| `TranscriptViewer` | `transcript-viewer.tsx` | D2 |
| `TranscriptRow` | `transcript-row.tsx` | D2 |
| `NudgeAlert` | `nudge-alert.tsx` | D3 |
| `CitationMarker` | `citation-marker.tsx` | D3 |
| `CitationPopover` | `citation-popover.tsx` | D3 |
| `SentimentTimeline` | `sentiment-timeline.tsx` | D4 |
| `BotChatPanel` | `bot-chat-panel.tsx` | D5 |
| `AIGeneratedBadge` | `ai-generated-badge.tsx` | D6 |
| `ConfidenceTag` | `confidence-tag.tsx` | D6 |
| `KBAssetCard` | `kb-asset-card.tsx` | D7 |
| `CoachingCard` | `coaching-card.tsx` | D7 |
| `AppShell` | `app-shell.tsx` | A4 |
| `Sidebar` | `sidebar.tsx` | A4 |
| `TopBar` | `top-bar.tsx` | A4 |

---

## 7. Component API Reference

### Button

```tsx
<Button
  variant="default" | "secondary" | "outline" | "ghost" | "destructive" | "icon"
  size="sm" | "default" | "lg" | "icon"
  loading={boolean}        // shows spinner, disables
  disabled={boolean}
  asChild={boolean}        // render as child element (Link, etc.)
/>
```

**Variants:**
- `default` — blue-600 fill (primary action, max 1 per section)
- `secondary` — slate border fill (complementary action)
- `outline` — border only, transparent bg
- `ghost` — no border, transparent (nav items, icon-only)
- `destructive` — red-600 fill (delete, revoke)
- `icon` — square, icon only, ghost bg

### Badge

```tsx
<Badge
  variant="default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "live"
/>
```

| Variant | Visual | Usage |
|---|---|---|
| `default` | blue fill | General tags, active state |
| `secondary` | slate fill | Neutral labels |
| `outline` | border only | Low-emphasis labels |
| `success` | green fill | Approved, completed |
| `warning` | amber fill | Pending review, low confidence |
| `destructive` | red fill | Error, failed |
| `live` | emerald fill + pulse | Active live call |

### Card

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
  </CardHeader>
  <CardContent>...</CardContent>
  <CardFooter>...</CardFooter>
</Card>
```

### EmptyState

```tsx
<EmptyState
  icon={LucideIcon}
  title="No calls today"
  description="Your next DC is scheduled for Thursday."
  action={{ label: "View all calls", href: "/calls" }}
/>
```

### CitationMarker

```tsx
<CitationMarker
  citationId="cite-01"
  index={1}                // superscript number
  source={{ title: "Acme Case Study", type: "case-study", url: "..." }}
/>
```

### ConfidenceTag

```tsx
<ConfidenceTag score={0.72} />
// score >= 0.8 → renders nothing (high confidence, no noise)
// 0.5 – 0.79 → amber badge "Low confidence"
// < 0.5 → red badge "Unverified"
```

### AIGeneratedBadge

```tsx
<AIGeneratedBadge />
// Always renders on machine-produced artifacts
// Shows robot icon + "AI-generated" label
// Clicking opens: what model, what prompt version, when generated
```

### TranscriptViewer

```tsx
<TranscriptViewer
  events={TranscriptEvent[]}
  keywords={string[]}
  isLive={boolean}         // auto-scrolls to latest when true
  onEventClick={(event) => void}
/>
```

### NudgeAlert

```tsx
<NudgeAlert
  message="Customer mentioned compliance 3x — surface the SOC 2 case study?"
  citation={{ title: "...", url: "..." }}
  role="ae" | "se" | "designer"
  onAccept={() => void}
  onDismiss={() => void}
/>
```

### BANTScorecard

```tsx
<BANTScorecard
  budget="confirmed" | "partial" | "unknown"
  authority="confirmed" | "partial" | "unknown"
  need="confirmed" | "partial" | "unknown"
  timeline="confirmed" | "partial" | "unknown"
/>
```

---

## 8. Do / Don't Guidelines

### Colors

| Do | Don't |
|---|---|
| Use `bg-primary text-primary-foreground` | Use `bg-blue-600 text-white` |
| Use `text-muted-foreground` for captions | Use `text-gray-500` (not a token) |
| Add a new token in `globals.css` if needed | Use arbitrary values `text-[#2563eb]` |
| Test every color in dark mode | Assume light mode is the only mode |

### Typography

| Do | Don't |
|---|---|
| Use sentence case for headings and buttons | Use Title Case for headings |
| Use `text-sm font-medium` for labels | Invent new sizes |
| Use `text-muted-foreground` for helper text | Use opacity to create lighter text |

### Components

| Do | Don't |
|---|---|
| Use `<Button variant="default">` for primary actions | Have more than 1 primary button per section |
| Use `<Badge variant="live">` with a pulse animation on live calls | Use raw CSS for live indicators |
| Use `<EmptyState>` for every empty list, table, or chart | Show blank space or a spinner for empty content |
| Use `<AIGeneratedBadge>` on every machine-produced artifact | Show AI output without attribution |
| Use `<CitationMarker>` on every factual AI claim | Render AI output as unlinked prose |

### Layout

| Do | Don't |
|---|---|
| Push `"use client"` to leaf components | Mark whole pages as `"use client"` |
| Use `loading.tsx` + Suspense for data pages | Show blank pages while loading |
| Use `gap-6` / `gap-8` for section spacing | Use `mt-6 mb-4` mixed margins |
| Test at 1024px (iPad landscape) every PR | Only test at full desktop width |

### AI Output

| Do | Don't |
|---|---|
| Show `<ConfidenceTag>` when score < 0.8 | Surface low-confidence output without warning |
| Gate outbound (email, CRM) behind explicit approval | Auto-send any AI-generated artifact |
| Show streaming text with a cursor indicator | Show blank then flash full content |
| Label every AI draft as "Draft — awaiting approval" | Display drafts as final |

---

## 9. Accessibility Standards

**Minimum: WCAG 2.2 AA**

### Contrast Ratios

| Pair | Ratio | Passes |
|---|---|---|
| `--foreground` on `--background` | 16:1 | AAA |
| `--primary-foreground` on `--primary` | 4.7:1 | AA |
| `--muted-foreground` on `--muted` | 4.6:1 | AA |
| `--destructive-foreground` on `--destructive` | 5.1:1 | AA |

### Keyboard Navigation

- All interactive elements reachable via `Tab`
- `Enter` / `Space` activates buttons and checkboxes
- `Esc` closes any modal, drawer, or popover
- Arrow keys navigate menus and comboboxes
- `Tab` cycles through transcript panels; `Esc` returns focus to main panel

### Focus Indicators

Never use `outline-none` without replacement. Required:

```css
/* replace default outline with custom focus ring */
focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

### ARIA Requirements

| Component | Requirement |
|---|---|
| `TranscriptViewer` | `aria-live="polite"` for new transcript entries |
| `NudgeAlert` | `role="alert"` for proactive nudges |
| `BotChatPanel` | `aria-live="polite"` on response stream container |
| `Dialog` | `role="dialog"` with `aria-labelledby`, `aria-describedby` |
| `DataTable` | `role="table"` with proper `aria-sort` on sortable columns |
| `SentimentTimeline` | Chart has `aria-label` describing the data range |
| `Badge variant="live"` | `aria-label="Live call in progress"` |

---

## 10. Dark Mode

### Implementation

Dark mode is toggled by adding/removing the `dark` class on `<html>`. Use `next-themes` for persistence and SSR safety.

```tsx
// providers.tsx
import { ThemeProvider } from "next-themes";
<ThemeProvider attribute="class" defaultTheme="system" enableSystem />
```

### Rules

1. Only use semantic tokens (`bg-background`, `text-foreground`) — never literal color classes
2. Test every new component in both modes before merging
3. Live call status indicators must remain perceptible in dark mode
4. Charts (Recharts) must use CSS variable colors, not hardcoded hex

### Checklist per component

- [ ] Text readable in both modes
- [ ] Borders visible in both modes
- [ ] Focus rings visible in both modes
- [ ] Status colors (success / warning / destructive / live) distinct in both modes
- [ ] No hardcoded color values

---

## 11. Figma Token Mapping

| Figma Style | CSS Token | Tailwind utility |
|---|---|---|
| Color/Primary/Default | `--primary` | `bg-primary` / `text-primary` |
| Color/Primary/Foreground | `--primary-foreground` | `text-primary-foreground` |
| Color/Background | `--background` | `bg-background` |
| Color/Foreground | `--foreground` | `text-foreground` |
| Color/Muted | `--muted` | `bg-muted` |
| Color/Muted/Text | `--muted-foreground` | `text-muted-foreground` |
| Color/Border | `--border` | `border-border` |
| Color/Destructive | `--destructive` | `bg-destructive` |
| Color/Success | `--success` | `bg-success` |
| Color/Warning | `--warning` | `bg-warning` |
| Color/Live | `--live` | `bg-live` |
| Text/Body | `text-base font-normal` | — |
| Text/Label | `text-sm font-medium` | — |
| Text/Caption | `text-xs text-muted-foreground` | — |
| Text/Heading2 | `text-2xl font-semibold` | — |
| Text/Heading3 | `text-xl font-semibold` | — |
| Radius/Default | `--radius` (0.5rem) | `rounded-lg` |
| Shadow/Card | — | `shadow-sm` |
| Shadow/Overlay | — | `shadow-xl` |

---

*This file is the source of truth for all visual decisions in DC Copilot. When in doubt, follow the tokens. When you need a new pattern, add it here first.*
