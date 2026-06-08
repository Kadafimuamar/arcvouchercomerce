---
name: migrate-arcvoucher-marketplace
description: Audit and implement the migration of `D:\arc-commerce-master` from the Arc Commerce USDC credit-purchase sample into the ArcVoucher gift card voucher marketplace. Use when planning or editing Supabase schema and RLS for `products`, `orders`, `voucher_inventory`, and `voucher_reveal_events`; refactoring credit-specific UI and APIs into voucher catalog, order, payment-verification, and reveal flows; updating the Circle webhook to fulfill voucher orders instead of incrementing credits; and extending the admin dashboard to manage products, stock, orders, and refunds without exposing voucher codes or service secrets.
---

# Migrate ArcVoucher Marketplace

## Workflow

1. Audit the repository before editing app code.
2. Read [references/repo-audit-plan.md](references/repo-audit-plan.md) for the repo-specific file map, migration plan, security rules, and implementation order.
3. On a planning-only request, return the nine plan sections from that reference before making app changes.
4. On an implementation request, follow the same order: database and types first, then APIs and server services, then UI, then webhook and reveal flow, then admin tooling, then validation.

## Non-Negotiables

- Never store real voucher codes on-chain.
- Never expose `voucher_inventory` rows or decrypted codes to the client.
- Never expose Circle API keys, Circle entity secrets, Supabase service role keys, or voucher encryption keys to the browser.
- Never mark an order as paid from client-side code.
- Keep `transactions`, `admin_wallets`, `transaction_events`, and `transaction_webhook_events` intact while the voucher flow is introduced.
- Treat `/api/transactions` as legacy unless the current task explicitly removes or replaces it.

## Audit First

Start by reading the current credit flow and dashboard surfaces:

- `app/page.tsx`
- `app/layout.tsx`
- `components/hero.tsx`
- `components/auth-button.tsx`
- `components/credits-badge.tsx`
- `components/user-dashboard.tsx`
- `components/wallet/purchase-credits-card.tsx`
- `components/wallet/transaction-confirmation-modal.tsx`
- `components/transaction-history-table.tsx`
- `components/user-transactions-table/columns.tsx`
- `app/api/transactions/route.ts`
- `app/api/transactions/[id]/route.ts`
- `app/api/circle/webhook/route.ts`
- `components/admin-dashboard.tsx`
- `types/supabase.ts`

Use the reference file as the source of truth for what to modify and add.

## Implementation Notes

- Prefer `text` columns plus `CHECK` constraints for new voucher/order statuses unless a task explicitly calls for new Postgres enums.
- Reuse the existing `public.handle_updated_at()` trigger function for new tables with `updated_at`.
- Treat `products.stock_count` as a cached availability number for UI/admin use. Do not rely on it as the source of truth for fulfillment; reserve from `voucher_inventory`.
- The requested order flow later requires `chain_id`, even though the initial table draft omits it. Add `orders.chain_id` in the migration unless the user explicitly rejects that adjustment.
- `types/supabase.ts` is manually kept in-repo and currently stale relative to recent migrations. Update it as part of schema work.

## Validation

- Run `npm run lint`.
- Run `npm run build`.
- Fix TypeScript drift introduced by the new schema, routes, or renamed components.
- If a turn is planning-only, do not modify app code; return the audit summary and step-by-step migration plan first.
