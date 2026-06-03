# Flat UI design system

Reference: Lendora-style dashboard — light gray canvas, white cards, pill navigation, minimal shadows.

## Principles

- **Canvas** `#F7F5F3` (`--background: 30 20% 96%`)
- **Glass cards** — frosted white gradient, `backdrop-filter: blur(12px)`, light border
- **12px corner radius** on cards (`--radius-card: 0.75rem`)
- **Pill-shaped** active nav and status chips (`border-radius: 9999px`)
- **Hairline borders** at ~85% opacity

## Tokens (`packages/ui/src/styles/tokens.css`)

| Token | Light value | Role |
|-------|-------------|------|
| `--background` | `30 20% 96%` (`#F7F5F3`) | Page canvas |
| `--card` | `0 0% 100%` | Card / panel surface |
| `--border` | `220 10% 91%` | Hairline stroke |
| `--radius` | `1.5rem` | Base radius (24px) |
| `--shadow-card` | `none` | Cards have no shadow |
| `--shadow-soft-xs` | micro shadow | Active nav pills only |

## Surfaces (`packages/ui/src/styles/app-surfaces.css`)

| Class | Usage |
|-------|--------|
| `.app-card` | Default card (dashboard widgets, briefing, etc.) |
| `.app-nav-item-active` | Rail icon — white pill + micro shadow |
| `.app-nav-link-active` | Sidebar link — white pill |
| `.app-sidebar-panel` | Expanded sidebar shell |

Legacy alias: `.glass-insight-card` → same as `.app-card`.

## Card CSS (glass)

```css
.app-card {
  border-radius: var(--radius-card); /* 12px */
  border: 1px solid rgb(255 255 255 / 0.72);
  background: linear-gradient(
    180deg,
    rgb(255 255 255 / 0.78) 0%,
    rgb(255 255 255 / 0.42) 100%
  );
  backdrop-filter: blur(12px) saturate(165%);
  box-shadow:
    0 1px 2px rgb(17 17 17 / 0.04),
    inset 0 1px 0 rgb(255 255 255 / 0.9);
}
```

## Status chips (example)

```html
<span class="rounded-full bg-warning/15 px-3 py-1 text-sm font-semibold">Complete</span>
<span class="rounded-full bg-muted px-3 py-1 text-sm">Active</span>
<span class="rounded-full bg-destructive/10 px-3 py-1 text-sm font-semibold text-destructive">Closed</span>
```

## React usage

```tsx
import { Card, CardContent } from "@dc-copilot/ui/components/card";

<Card>
  <CardContent className="p-6">…</CardContent>
</Card>
```

`Card` applies `app-card` automatically.
