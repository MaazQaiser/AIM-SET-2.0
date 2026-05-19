# AIM SET 2.0 (DC Copilot)

AI-native Discovery Call platform for IT services sales — pre-call briefs, live cockpit, post-call review, and CSV-driven lead data.

## Stack

- **Web:** Next.js 16 · Tailwind CSS v4 · TypeScript
- **Auth:** Clerk (Google / Microsoft SSO)
- **State:** Zustand · TanStack Query v5
- **Monorepo:** Turborepo · pnpm workspaces
- **Backend (optional):** Python FastAPI — not included in this repo; frontend works with mocks + CSV import

---

## What is not in Git (and why)

These are listed in `.gitignore` and are **created on each machine** after clone:

| Item | Why not in Git | What you do locally |
|------|----------------|---------------------|
| `node_modules/` | Huge; reinstall from lockfile | `pnpm install` |
| `apps/web/.next/` | Build cache; regenerated | `pnpm dev` or `pnpm build` |
| `apps/web/.env.local` | Secrets (API keys) | Copy from `.env.example` |
| `.turbo/`, `dist/` | Build artifacts | Auto-generated |

Only **source code**, `pnpm-lock.yaml`, and **`apps/web/.env.example`** (template, no secrets) are in the repository.

---

## Prerequisites

Install these before cloning:

| Tool | Version | Check |
|------|---------|--------|
| **Node.js** | 20.x or newer (LTS recommended) | `node -v` |
| **pnpm** | 9.x (repo uses `pnpm@9.15.0`) | `pnpm -v` |
| **Git** | Any recent version | `git -v` |

Install pnpm if needed:

```bash
npm install -g pnpm@9
```

Enable pnpm via Corepack (alternative):

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
```

---

## Setup (new developer)

### 1. Clone the repository

```bash
git clone git@github.com:MaazQaiser/AIM-SET-2.0.git
cd AIM-SET-2.0
```

HTTPS:

```bash
git clone https://github.com/MaazQaiser/AIM-SET-2.0.git
cd AIM-SET-2.0
```

### 2. Install dependencies

From the **repository root** (not only `apps/web`):

```bash
pnpm install
```

This installs all workspace packages and creates `node_modules/` locally (not from Git).

### 3. Environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edit `apps/web/.env.local` and set at least the **Clerk** keys (see below).

### 4. Clerk authentication

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com) and create an application.
2. Open **API Keys** and copy:
   - Publishable key → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
   - Secret key → `CLERK_SECRET_KEY`
3. In Clerk, configure sign-in URLs if needed (defaults in `.env.example` match this app).

**Note:** In development, Clerk may run in **keyless mode** without keys (limited). For full auth, use real keys in `.env.local`.

### 5. Run the web app

From the repository root:

```bash
pnpm dev
```

Or run only the web app on a specific port:

```bash
pnpm --filter @dc-copilot/web run dev --port 3002
```

Open in the browser:

- Default: [http://localhost:3000](http://localhost:3000)
- If port 3000 is busy, Next.js may use **3001** — check the terminal output.

### 6. Load call / lead data (CSV)

The app uses **your CSV data**, not hardcoded demo calls.

1. Sign in (or use Clerk dev mode).
2. Go to **Settings → Data import**.
3. Upload **`pre_dc_notes_data.csv`** (Pre-DC research — creates calls and briefs).
4. Optionally upload **`post_dc_notes_data.csv`** (Post-DC notes — import Pre-DC first for best linking).

Expected Pre-DC columns include `Company Name-PreDC`, `Discovery Call Date (PKT)`, `Discovery Call Time (PKT)`, `Lead Name-PreDC`, etc. (see `apps/web/src/types/dc-notes.ts`).

After import:

- **Home** — calendar of discovery calls (dates from CSV).
- **Calls** — all leads; open a call for the **Pre-call brief**.
- **Post-DC** tab — when a Post-DC row matches a company.

---

## Optional setup

### Google Calendar (Settings → Integrations)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Google Calendar API**.
3. Create **OAuth 2.0 Client ID** (Web application).
4. Add redirect URI (match your dev port), e.g.  
   `http://localhost:3000/api/integrations/google/callback`
5. Add to `apps/web/.env.local`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
GOOGLE_WEBHOOK_SECRET=your_long_random_secret
```

Restart `pnpm dev` after changing env vars.

### Python backend (optional)

Some API routes proxy to `API_URL` (default `http://localhost:8000`). The UI still works **without** the backend using mock data and CSV imports.

If you run a FastAPI service later, set in `.env.local`:

```env
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

## Useful commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode (Turbo) |
| `pnpm --filter @dc-copilot/web run dev` | Web app only |
| `pnpm --filter @dc-copilot/web run dev --port 3002` | Web on port 3002 |
| `pnpm build` | Production build |
| `pnpm --filter @dc-copilot/web run type-check` | TypeScript check |
| `pnpm lint` | Lint (Biome) |

---

## Project structure

```
AIM-SET-2.0/
├── apps/web/              # Next.js frontend (main app)
│   ├── src/app/           # Routes (dashboard, calls, settings, API)
│   ├── src/components/    # UI components
│   ├── src/lib/           # CSV import, data resolvers, mocks
│   └── .env.example       # Env template → copy to .env.local
├── packages/types/        # Shared TypeScript types
├── packages/ui/           # Shared UI package
├── pnpm-workspace.yaml
├── pnpm-lock.yaml         # Locked dependency versions
└── turbo.json
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `pnpm: command not found` | Install pnpm 9 (see Prerequisites). |
| Port already in use | Use `--port 3002` or stop the other process on 3000. |
| Blank calls / empty home | Import **Pre-DC CSV** under Settings → Data import. |
| Clerk errors | Set keys in `.env.local` or use Clerk keyless dev claim URL in terminal. |
| Changes to `.env.local` not applied | Restart `pnpm dev`. |
| `Module not found` after pull | Run `pnpm install` again at repo root. |

---

## Design system & specs

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) — tokens and components
- [01_PRD.md](./01_PRD.md) through [10_Storyline.md](./10_Storyline.md) — product and architecture docs

---

## Repository

**https://github.com/MaazQaiser/AIM-SET-2.0**
