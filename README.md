# DC Copilot

AI-native Discovery Call platform for IT services sales.

## Stack

- **Web:** Next.js 16 · Tailwind CSS v4 · shadcn/ui · TypeScript
- **Auth:** Clerk (Google + Microsoft SSO)
- **State:** Zustand · TanStack Query v5
- **Backend:** Python FastAPI (separate services)
- **Monorepo:** Turborepo · pnpm workspaces

## Getting started

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp apps/web/.env.example apps/web/.env.local
# Fill in Clerk keys from https://dashboard.clerk.com

# Run the web app
pnpm dev
```

## Structure

```
apps/
  web/          Next.js 16 frontend + BFF
packages/
  ui/           Shared component library
  types/        Shared TypeScript types
services/       Python FastAPI microservices (backend)
```

## Design system

See [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) for the complete token reference, component inventory, and usage guidelines.

## Spec documents

| File | Contents |
|---|---|
| [01_PRD.md](./01_PRD.md) | Product requirements |
| [02_Architecture.md](./02_Architecture.md) | System architecture |
| [03_Agent_Specs.md](./03_Agent_Specs.md) | AI agent specifications |
| [04_Tech_Stack.md](./04_Tech_Stack.md) | Technology decisions |
| [05_Project_Conventions.md](./05_Project_Conventions.md) | Coding conventions |
| [06_Frontend_Guidelines.md](./06_Frontend_Guidelines.md) | Frontend patterns |
| [07_Backend_Guidelines.md](./07_Backend_Guidelines.md) | Backend patterns |
| [08_Production_Checklist.md](./08_Production_Checklist.md) | Pre-launch checklist |
| [09_AI_Coding_Rules.md](./09_AI_Coding_Rules.md) | AI assistant rules |
