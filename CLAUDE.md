# Fener demo store

Learning project: a custom online store with an admin panel, no Shopify. The owner is learning how the parts connect, so every non-trivial change needs a short plain-language "why" in Bulgarian in your reply.

## Rules
- Customer-facing text is Bulgarian. Code, comments and identifiers are English. Never use the em dash character (U+2014).
- Prices, totals, stock and order status are decided only on the server (`src/server`, `src/app/actions`). The browser sends ids and quantities.
- Money is integer cents. Format only with `formatEur()` from `src/lib/money.ts`.
- Status changes go through `transitionOrderTx()` in `src/server/orders.ts`; allowed moves are in `src/lib/order-status.ts`.
- Every admin page and admin Server Action calls `requireAdmin()`.
- Schema changes: edit `src/db/schema.ts`, then `npm run db:generate`. Never edit migration SQL by hand and never rewrite an existing migration: add a new one.
- Database: PGlite locally (no DATABASE_URL), postgres-js online. Code uses the `DB`/`Tx` types from `src/db/types.ts` only.
- Online builds run `scripts/migrate.ts` (tables, demo data, admin from ADMIN_EMAIL / ADMIN_PASSWORD).
- After changes run `npm run typecheck`, `npm test` and, for flow changes, `npm run test:e2e`.

@AGENTS.md
