# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint (flat config with next/core-web-vitals + prettier)
npm test             # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
npx drizzle-kit generate   # Generate DB migration from schema changes
npx drizzle-kit push       # Push schema directly to database
```

## Architecture

**Multi-tenant household budget app** using envelope-style budgeting tied to paycheck periods. Every user belongs to a household; all data is scoped by `householdId`.

### Tech Stack
Next.js 16 (App Router) · React 19 · TypeScript · Ant Design 6 · Drizzle ORM · PostgreSQL (Neon serverless) · Auth.js v5 · TanStack Query · Zustand · Zod · PostHog (optional)

### Key Architectural Patterns

**Tenant isolation**: Every API route calls `requireAuth()` from `src/lib/auth/require-auth.ts`, which returns `{ user, householdId }`. All DB queries must filter by `householdId`. The security audit tests (`src/__tests__/security-audit.test.ts`) enforce this automatically — they grep every route file to verify `requireAuth` is imported and `householdId`/`household_id` is referenced. New API routes will fail tests if they skip this.

**Auth split**: `src/auth.ts` has the full Auth.js config (DB access, bcrypt). `src/auth.config.ts` is the edge-safe subset (no Node.js imports) used by `proxy.ts` (the Next.js middleware) for route protection.

**Money as cents**: All monetary values are stored as integer cents (`amount_cents`, `balance_cents`, `opening_balance_cents`). Never use floating point for money.

**API layer** (client-side):
- `src/lib/api/client.ts` — typed fetch wrapper (`apiGet`, `apiPost`, `apiPut`, `apiPatch`, `apiDelete`)
- `src/lib/api/*.ts` — domain-specific functions and TanStack Query hooks (one file per domain)
- `src/lib/api/query-keys.ts` — centralized query key factory

**Validation**: All API request bodies and query params are validated with Zod schemas in `src/lib/validators/*.ts`.

### Directory Layout

- `src/app/(protected)/` — authenticated pages (dashboard, accounts, budget, transactions, etc.)
- `src/app/api/` — API route handlers (~85 routes across 13 domains)
- `src/db/schema/` — Drizzle schema files organized by domain (accounts, auth, budget, household, imports, reconciliation, recurring, transactions)
- `src/db/index.ts` — DB client (auto-selects Neon serverless driver vs node-postgres based on connection string)
- `src/lib/api/` — client-side API functions and React Query hooks
- `src/lib/validators/` — Zod schemas for API input validation
- `src/lib/utils/` — business logic engines (budget, recurring, accounting, money, CSV/QBO parsing)
- `src/components/` — React components organized by feature domain
- `src/stores/` — Zustand stores (auth-store, ui-store)
- `proxy.ts` — Next.js middleware for route protection (redirects unauthenticated users)
- `drizzle/` — generated SQL migrations

### Provider Hierarchy (root layout)
`SessionProvider → PostHogProvider (conditional) → QueryProvider → AntdRegistry → ConfigProvider`

## Code Style

Prettier: no semicolons, single quotes, 2-space indent, trailing commas, 100 char print width. Path alias `@/*` maps to `./src/*`.

## Environment

Config in `.env.local` — see `docs/ENV.md` for all variables. Required: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, Google/Microsoft OAuth credentials, `PEPPER_SECRET`.
