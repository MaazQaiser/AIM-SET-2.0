# Frontend Guidelines
**Applies to:** `apps/web` and `packages/ui`
**Audience:** Frontend engineers and AI coding assistants
**Version:** 0.1 (Draft)

---

## 0. Reading order for AI assistants

When working in the frontend, follow this order:

1. Read this file
2. Read `05_Project_Conventions.md` for naming, structure, git
3. Read `09_AI_Coding_Rules.md` for code-generation rules
4. Read the relevant existing component before creating a new one

Do not skip steps. Most "the AI wrote weird code" outcomes trace to not reading existing patterns first.

---

## 1. Core Principles

1. **Server-first.** Default to Server Components. Add `"use client"` only when you need state, effects, or browser APIs.
2. **Composition over configuration.** Build small components that compose, not god-components with 30 props.
3. **Predictable, not clever.** Boring code is correct code. Save creativity for design, not control flow.
4. **Accessibility is non-negotiable.** WCAG 2.2 AA minimum. The leadership dashboard will be used by people on iPad in meetings.
5. **Performance budget is a feature.** A slow dashboard is a broken dashboard.

---

## 2. Next.js App Router Patterns

### Route organization

```
apps/web/src/app/
├── (auth)/                     # Route group for auth pages
│   ├── sign-in/
│   └── sign-up/
├── (dashboard)/                # Route group for authenticated pages
│   ├── layout.tsx              # Dashboard shell
│   ├── page.tsx                # Default dashboard route
│   ├── calls/
│   │   ├── page.tsx            # Call list
│   │   └── [callId]/
│   │       ├── page.tsx        # Call detail
│   │       └── live/page.tsx   # Live call view
│   ├── knowledge/
│   ├── coaching/
│   └── settings/
├── api/                        # BFF route handlers (thin layer over Python services)
│   ├── webhooks/
│   └── trpc-or-rest/
├── layout.tsx                  # Root layout
└── globals.css
```

### Server vs Client Components

**Server (default):**
- Pages, layouts
- Data fetching
- Anything that doesn't need interactivity
- Reading cookies, headers
- Calling backend services directly

**Client (`"use client"`):**
- `useState`, `useEffect`, `useReducer`, `useContext`
- Event handlers (`onClick`, `onChange`)
- Browser APIs (WebSocket, IntersectionObserver, localStorage)
- Third-party libraries that require client (charts, animation libs)

### Composition rule

Push client boundaries to the leaves, not the trunk. A page that's `"use client"` blocks server rendering of everything inside it.

✅ **Correct:**
```tsx
// app/(dashboard)/calls/[callId]/page.tsx — Server Component
export default async function CallPage({ params }: Props) {
  const call = await fetchCall(params.callId);
  return (
    <CallLayout>
      <CallHeader call={call} />
      <InteractiveCallTimeline call={call} />  {/* this one is "use client" */}
      <CallSummary summary={call.summary} />
    </CallLayout>
  );
}
```

❌ **Wrong:**
```tsx
"use client";  // blocks the whole page from server rendering
export default function CallPage() {
  const [state, setState] = useState(...);
  // entire page is client-rendered
}
```

### Data fetching

- **Server Components:** call backend services directly via the typed API client; no `fetch` from the client when avoidable
- **Client Components:** use TanStack Query; the BFF (Next API routes) is the bridge
- **Suspense + loading.tsx** for streaming UX, especially for the dashboard
- **Never use `getServerSideProps` or `getStaticProps`** — those are Pages Router relics

### Caching

- Use Next 16's explicit caching directives; don't rely on implicit defaults
- `revalidate` for ISR pages; `dynamic = 'force-dynamic'` for always-fresh
- Tag-based revalidation for fine-grained invalidation

---

## 3. Component Structure

### Anatomy of a component file

```tsx
// CallTimeline.tsx
import { useState, useMemo } from "react";
import { Card } from "@/packages/ui/card";
import { formatDuration } from "@/lib/format-duration";
import type { Call, TimelineEvent } from "@/types/call";

interface CallTimelineProps {
  call: Call;
  onEventClick?: (event: TimelineEvent) => void;
}

export function CallTimeline({ call, onEventClick }: CallTimelineProps) {
  // 1. State
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 2. Derived values
  const sortedEvents = useMemo(
    () => [...call.events].sort((a, b) => a.timestamp - b.timestamp),
    [call.events]
  );

  // 3. Handlers
  function handleClick(event: TimelineEvent) {
    setSelectedId(event.id);
    onEventClick?.(event);
  }

  // 4. Render
  return (
    <Card>
      {sortedEvents.map((event) => (
        <TimelineRow
          key={event.id}
          event={event}
          isSelected={selectedId === event.id}
          onClick={() => handleClick(event)}
        />
      ))}
    </Card>
  );
}

// Internal sub-component — not exported
function TimelineRow({ event, isSelected, onClick }: TimelineRowProps) {
  // ...
}
```

### Rules

- **Named exports**, not default exports (better for refactoring, find-references, AI tools)
- **Props are an interface**, not a type alias, when they could be extended
- **Order:** state → derived → handlers → effects → render
- **Effects are a last resort.** Most things don't need them
- **Internal sub-components are fine** in the same file if they're not reused

### Component size

- If a component exceeds **150 lines**, it's probably doing too much. Split it
- If a component has **more than 7 props**, the API is probably wrong. Group props into a config object or compose differently

---

## 4. State Management

### Decision tree

| What you have | Where it lives |
|---|---|
| URL/route data | Route params, search params |
| Server data | TanStack Query |
| Form state | React Hook Form |
| UI state local to one component | `useState` |
| UI state shared by 2–3 nearby components | Lift to common parent |
| UI state shared widely (modals, toasts, theme) | Zustand |
| Auth state | Clerk hooks |
| Real-time data (live call) | Custom WebSocket hook + Zustand |

### Zustand stores

- One store per concern, not one mega-store
- Store files in `apps/web/src/stores/`
- Always export hooks, never the store directly
- Use selectors to avoid unnecessary re-renders

```tsx
// stores/use-call-ui.ts
import { create } from "zustand";

interface CallUIState {
  activePanel: "transcript" | "kb" | "chat" | null;
  setActivePanel: (panel: CallUIState["activePanel"]) => void;
}

export const useCallUI = create<CallUIState>((set) => ({
  activePanel: "transcript",
  setActivePanel: (activePanel) => set({ activePanel }),
}));
```

### What NOT to put in global state
- Form values (use React Hook Form)
- Server data (use TanStack Query)
- Anything that could be derived from URL or server data

---

## 5. Styling

### Rules
- **Tailwind classes only.** No inline styles, no CSS modules, no styled-components
- **Use Tailwind's design tokens** (spacing, colors, typography). Don't write arbitrary values like `text-[#3b82f6]` unless it's a one-off
- **Avoid `!important`.** If you need it, the cascade is wrong
- **Conditional classes** via `clsx` or `cn` helper, not string concatenation

```tsx
import { cn } from "@/lib/cn";

<button
  className={cn(
    "rounded-md px-4 py-2 font-medium transition-colors",
    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
    disabled && "opacity-50 cursor-not-allowed"
  )}
/>
```

### Design tokens

We use shadcn's CSS variable approach. Tokens defined in `globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 240 10% 3.9%;
  --primary: 240 5.9% 10%;
  /* ... */
}
```

Don't introduce hardcoded hex values in components. If a new color is needed, add a token.

### Responsive design
- Mobile-first: base classes are mobile, prefixes (`md:`, `lg:`) add breakpoints
- Test at 375px (mobile), 768px (tablet), 1280px (desktop), 1920px (large desktop)
- The leadership dashboard must work at 1024px (iPad landscape)

### Dark mode
- Built in via shadcn's CSS variables
- Use semantic tokens (`bg-background`, `text-foreground`), not literal colors
- Test every component in both modes

---

## 6. Accessibility (a11y)

**WCAG 2.2 AA is the floor, not the ceiling.**

### Non-negotiables
- Every interactive element keyboard-accessible (Tab, Enter, Esc, Arrow keys where relevant)
- Visible focus indicators (don't `outline-none` without replacement)
- Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text
- Every `<img>` has meaningful alt text or `alt=""` if decorative
- Form inputs have associated `<label>` (use shadcn's `<Label>`)
- Headings in logical order (h1 → h2 → h3); never skip levels for styling
- Modals trap focus, restore focus on close
- Live regions (`aria-live`) for the real-time call panels — but don't over-announce
- No keyboard traps; Esc always exits modals/menus

### Tools
- **eslint-plugin-jsx-a11y** in CI; build fails on violations
- **axe-core** in E2E tests
- Manual keyboard-only walkthrough before every release

---

## 7. Forms

### Stack
- **React Hook Form** for state
- **Zod** for validation
- **shadcn Form components** for layout
- **Backend Pydantic schema is the source of truth**; share Zod schemas via the generated types package where possible

```tsx
const schema = z.object({
  email: z.string().email(),
  message: z.string().min(10).max(500),
});

type FormValues = z.infer<typeof schema>;

export function FeedbackForm() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  function onSubmit(values: FormValues) {
    // ...
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        {/* ... */}
      </form>
    </Form>
  );
}
```

### Rules
- Errors appear inline next to fields, not in a top-level summary (or both, with `aria-describedby` linking)
- Submit buttons disabled during submission
- Successful submission gives explicit feedback (toast, redirect, etc.)
- Destructive actions require confirmation (modal or explicit confirmation step)

---

## 8. Real-Time Live Call UI

The live call view is the most demanding surface. It runs for the duration of a 45–90 minute call with continuous updates.

### Constraints
- Transcript updates every ~2s; UI must not jank
- Nudges appear async; must not interrupt typing in bot-chat
- Memory must not grow unbounded over a 90-minute session

### Patterns
- **Virtualized transcript list** (TanStack Virtual) — never render 5000 messages in DOM
- **Custom WebSocket hook** with auto-reconnect, exponential backoff
- **Debounced state updates** for high-frequency events (sentiment, keywords)
- **Cleanup is sacred** — every effect that opens a connection or subscription must have a cleanup
- **Test with the React DevTools profiler** before shipping

### Layout
- Three-column on desktop: transcript | content/KB | bot-chat
- Stacked tabs on tablet/mobile (panel switcher in Zustand)

---

## 9. Performance

### Budgets
- **First Contentful Paint:** <1.5s on 3G Fast
- **Largest Contentful Paint:** <2.5s
- **Total Blocking Time:** <200ms
- **JS bundle (per route):** <250KB gzipped

### Practices
- Lazy-load below-the-fold components with `next/dynamic`
- Image optimization via `next/image`, never raw `<img>` for user-facing content
- Code-split heavy charts and data viz
- Use server components to ship less JS
- Preload critical fonts; subset to characters needed

### Monitoring
- Real User Monitoring via Vercel Analytics or custom (Web Vitals → Langfuse/Datadog equivalent)
- Synthetic checks on critical pages
- Bundle analyzer runs in CI; build fails if a route exceeds budget by 20%

---

## 10. Error Handling and Loading States

### Loading
- `loading.tsx` at the route level for full-page loading
- Skeleton states (`<Skeleton />`) inside Suspense boundaries for incremental loading
- **Never show blank screens** — there's always either content, skeleton, or empty state
- Spinners only for actions <2s; longer needs progress or skeleton

### Errors
- `error.tsx` at the route level catches uncaught errors; provides recovery action
- Toast notifications for transient errors (TanStack Query's `onError`)
- Form errors inline, never via toast
- Empty states are not errors; design them deliberately

### Empty states
Every list, table, and chart must have an empty state. The empty state should:
- Explain what would normally be here
- Tell the user how to get there ("No calls today — your next DC is Thursday")
- Look intentional, not broken

---

## 11. Testing

### What to test
- **Unit:** pure logic (formatters, scoring, derivations)
- **Component:** rendering + interaction with Vitest + Testing Library
- **Integration:** features that span multiple components (forms, flows)
- **E2E:** critical user paths with Playwright

### What not to test
- Implementation details (internal state, private functions)
- Third-party library behavior
- Snapshot tests for layouts that change frequently

### Patterns
- Use **Testing Library queries by role/label**, not by test id (test ids are last resort)
- Mock the network layer, not React itself
- Co-locate tests with components

---

## 12. Internationalization (i18n)

**v1 is English-only.** But:
- Don't hardcode user-facing strings in JSX. Use a `messages` module from day one
- Date/time formatting via `date-fns` with explicit locale
- Number formatting via `Intl.NumberFormat`
- Build the i18n switch in v2; don't paint ourselves into a corner now

---

## 13. AI Output Rendering

Special concerns because most user-visible content is AI-generated:

### Citations
- Every AI claim renders with a citation marker (superscript number or icon)
- Citation click opens a popover with source preview + link to full asset
- Citations are interactive, not decorative

### Markdown
- AI generates markdown; we render with `react-markdown + remark-gfm`
- Sanitize on render (no raw HTML)
- Code blocks get syntax highlighting (Shiki)

### Streaming
- Stream AI responses where latency matters (bot-chat, post-call summary)
- Show a typing indicator only when actually waiting on first token

### Trust signals
- Confidence scores rendered subtly when relevant (≥0.8 = no marker, 0.5–0.8 = "low confidence" tag, <0.5 = warning)
- "AI-generated" badge on every machine-produced artifact
- Editable indicators clear: the user knows when they're looking at a draft vs final

---

## 14. House Style Notes

- **No em-dashes, en-dashes, or hyphen-as-connector in user-facing copy.** Restructure sentences instead. (House style.)
- Sentence case for headings and buttons, not Title Case
- "Sign in" not "Login" (verb when it's an action, noun when it's a thing)
- Microcopy is plain English, not corporate-speak
- Numbers: digits for 10+ ("5 calls", "12 calls"); spell out under 10 in narrative copy
