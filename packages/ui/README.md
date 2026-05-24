# @dc-copilot/ui

Shared UI primitives and design tokens for DC Copilot.

## CSS

Import the global design-system CSS once at the app root:

```css
@import "@dc-copilot/ui/globals.css";
```

The global CSS includes Tailwind, semantic light/dark color tokens, typography tokens,
focus/scrollbar base styles, animation utilities, shadows, glass surfaces, and page hue utilities.

## Components

Import shared primitives from the package root or component subpaths:

```tsx
import { Button, Card, Typography } from "@dc-copilot/ui";
import { Button } from "@dc-copilot/ui/components/button";
```

Product-specific UI should stay inside the consuming app. Reusable primitives, layout pieces,
and interaction patterns should live here.

## Tokens

CSS tokens are defined in `src/styles/tokens.css`. Runtime token references for charts or custom
renderers are exported from `src/tokens.ts`:

```ts
import { designTokens } from "@dc-copilot/ui/tokens";
```

## Typography

Use CSS utilities such as `type-display`, `type-title`, `type-body`, and `type-caption`, or the
React typography helpers:

```tsx
import { Title, Text } from "@dc-copilot/ui";

<Title>Pipeline overview</Title>
<Text muted>Updated from the latest discovery calls.</Text>
```
