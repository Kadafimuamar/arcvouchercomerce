# ArcVoucher Repo Audit Plan

## 1. Existing repo structure summary

- `app/`: Next.js App Router pages, auth pages, dashboard pages, and route handlers. Current payment flow lives in `app/api/transactions/*`; Circle webhook lives in `app/api/circle/webhook/route.ts`.
- `components/`: Landing page, auth shell, user/admin dashboards, wallet flow, and transaction history UI. The current purchase UI is `components/wallet/purchase-credits-card.tsx`.
- `lib/supabase/`: Browser, server, and service-role Supabase clients.
- `lib/wagmi/`: Wallet, network, and USDC chain configuration. Arc Testnet is already configured in `lib/wagmi/config.ts`.
- `lib/circle/`: Circle Developer Controlled Wallets helpers.
- `supabase/migrations/`: Existing transaction, admin wallet, webhook, and credits migrations. The voucher marketplace should be additive and must not break `transactions`, `admin_wallets`, `transaction_events`, or `transaction_webhook_events`.
- `types/supabase.ts`: Manual in-repo Supabase types. It is already stale because it still includes dropped legacy shapes, so schema work must update this file.

Current credit flow discovered in the audit:

1. User connects wallet in the dashboard.
2. `PurchaseCreditsCard` transfers USDC to an admin wallet.
3. The client posts to `/api/transactions`.
4. The confirmation modal can patch `/api/transactions/[id]` to mark `complete`.
5. `app/api/circle/webhook/route.ts` confirms the transaction and calls `increment_credits`.
6. The dashboard and nav show credit balances and credit purchase history.

## 2. Exact files that should be modified

- `app/layout.tsx`
- `app/page.tsx`
- `app/dashboard/[txHash]/page.tsx`
- `app/api/circle/webhook/route.ts`
- `app/api/destination-wallet/route.ts`
- `app/api/transactions/route.ts`
- `app/api/transactions/[id]/route.ts`
- `components/hero.tsx`
- `components/auth-button.tsx`
- `components/credits-badge.tsx`
- `components/user-dashboard.tsx`
- `components/admin-dashboard.tsx`
- `components/transaction-history-table.tsx`
- `components/user-transactions-table/columns.tsx`
- `components/wallet/purchase-credits-card.tsx`
- `components/wallet/transaction-confirmation-modal.tsx`
- `types/supabase.ts`
- `.env.example`

Database migration file to add:

- `supabase/migrations/<timestamp>_create_arcvoucher_marketplace.sql`

Notes from the audit:

- `lib/wagmi/config.ts` already includes Arc Testnet, so it does not need a first-pass change unless the UI should restrict visible chains.
- `app/dashboard/page.tsx` can stay as the user/admin switch unless the dashboard data-loading strategy changes.

## 3. New files that should be added

- `app/api/products/route.ts`
- `app/api/orders/route.ts`
- `app/api/orders/[id]/status/route.ts`
- `app/api/orders/[id]/reveal/route.ts`
- `app/api/admin/products/route.ts`
- `app/api/admin/products/[id]/route.ts`
- `app/api/admin/voucher-inventory/route.ts`
- `app/api/admin/orders/route.ts`
- `app/api/admin/orders/[id]/refund/route.ts`
- `components/marketplace/product-grid.tsx`
- `components/marketplace/product-card.tsx`
- `components/orders/order-history.tsx`
- `components/orders/voucher-reveal-dialog.tsx`
- `components/wallet/voucher-checkout-card.tsx`
- `components/admin/products-table.tsx`
- `components/admin/voucher-inventory-table.tsx`
- `components/admin/orders-table.tsx`
- `components/admin/refund-dialog.tsx`
- `lib/orders/fulfillment.ts`
- `lib/orders/status.ts`
- `lib/vouchers/encryption.ts`

## 4. Database migration plan

Create one additive migration that introduces the voucher marketplace without touching legacy transaction tables.

Schema:

- `products`
  - `id uuid primary key default gen_random_uuid()`
  - `name text not null`
  - `brand text not null`
  - `description text`
  - `price_usdc numeric(18,6) not null`
  - `image_url text`
  - `active boolean default true`
  - `stock_count integer default 0`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`

- `orders`
  - `id uuid primary key default gen_random_uuid()`
  - `user_id uuid references auth.users(id)`
  - `product_id uuid references products(id)`
  - `product_name text not null`
  - `price_usdc numeric(18,6) not null`
  - `quantity integer default 1`
  - `wallet_address text`
  - `destination_address text`
  - `tx_hash text`
  - `circle_transaction_id text`
  - `chain_id bigint not null`
  - `status text not null default 'pending'`
  - `voucher_inventory_id uuid null`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`

- `voucher_inventory`
  - `id uuid primary key default gen_random_uuid()`
  - `product_id uuid references products(id)`
  - `code_ciphertext text not null`
  - `code_hash text not null`
  - `status text not null default 'available'`
  - `assigned_order_id uuid null references orders(id)`
  - `created_at timestamptz default now()`
  - `updated_at timestamptz default now()`

- `voucher_reveal_events`
  - `id uuid primary key default gen_random_uuid()`
  - `order_id uuid references orders(id)`
  - `user_id uuid references auth.users(id)`
  - `revealed_at timestamptz default now()`
  - `ip_hash text null`

Constraints and indexes:

- Use `CHECK` constraints on `orders.status` with `pending`, `paid`, `fulfilled`, `revealed`, `refunded`, `failed`.
- Use `CHECK` constraints on `voucher_inventory.status` with `available`, `reserved`, `revealed`, `disabled`.
- Add indexes for:
  - `orders(user_id)`
  - `orders(product_id)`
  - `orders(status)`
  - `orders(tx_hash)`
  - `orders(circle_transaction_id)`
  - `voucher_inventory(product_id)`
  - `voucher_inventory(status)`
  - `voucher_reveal_events(order_id)`
  - `voucher_reveal_events(user_id)`
- Add a unique index on `voucher_inventory(code_hash)`.
- Add a partial unique index on non-null `orders(tx_hash)` and optionally `orders(circle_transaction_id)` for webhook idempotency.
- Add the `orders.voucher_inventory_id -> voucher_inventory(id)` foreign key after both tables exist.
- Reuse `public.handle_updated_at()` triggers for `products`, `orders`, and `voucher_inventory`.

RLS:

- `products`: allow `SELECT` for active rows to anon/authenticated users; service role manages all writes.
- `orders`: allow authenticated users to `SELECT` only rows where `user_id = auth.uid()`. Allow authenticated users to `INSERT` only their own `pending` orders. Do not allow normal users to update status or assigned voucher fields directly.
- `voucher_inventory`: no read access for normal users. Only service-role or admin-backed server code manages it.
- `voucher_reveal_events`: service-role insert only. Optional owner `SELECT` can be added later if the UI needs a reveal audit trail.

Implementation notes:

- Do not use `COMMENT ON` statements in the new migration.
- Do not drop or alter `transactions`, `admin_wallets`, `transaction_events`, or `transaction_webhook_events`.
- `products.stock_count` should be treated as cached display/admin state, not the authoritative fulfillment source. Reserve real stock from `voucher_inventory`.
- Strongly consider adding a SQL helper function in the same migration or a follow-up migration to atomically reserve one available voucher with `FOR UPDATE SKIP LOCKED`.
- Update `types/supabase.ts` after the migration because the repo keeps Supabase types manually.

## 5. API route plan

Core routes:

- `GET /api/products`
  - Return active products only.
  - Expose product metadata and stock availability summary only.
  - Never expose voucher inventory rows or hashes.

- `POST /api/orders`
  - Require authenticated user.
  - Validate product is active and price snapshot is current.
  - Create a `pending` order with `product_id`, `product_name`, `price_usdc`, `wallet_address`, `destination_address`, `chain_id`, and later `tx_hash` once the wallet returns it.
  - Do not mark the order paid here.

- `GET /api/orders`
  - Require authenticated user.
  - Return only the caller's orders, newest first.

- `GET /api/orders/[id]/status`
  - Require authenticated user.
  - Verify ownership.
  - Return normalized order status, payment metadata, and whether reveal is allowed.

- `POST /api/orders/[id]/reveal`
  - Require authenticated user.
  - Verify ownership and order status.
  - Load voucher data with service role only.
  - Decrypt and return only the assigned voucher code.
  - Insert `voucher_reveal_events`.
  - Transition `orders.status` to `revealed` and `voucher_inventory.status` to `revealed`.

Admin routes:

- `POST/GET /api/admin/products`
- `PATCH/DELETE /api/admin/products/[id]`
- `POST/GET /api/admin/voucher-inventory`
- `GET /api/admin/orders`
- `POST /api/admin/orders/[id]/refund`

Admin route rules:

- Gate access on the existing admin check already used by the dashboard.
- Use service-role-backed server code.
- Never return decrypted voucher codes in admin listing responses.

Legacy route handling:

- Keep `/api/transactions` and `/api/transactions/[id]` for legacy history and treasury compatibility until the voucher order flow fully replaces the user-facing credit flow.
- Remove or bypass credit-granting logic inside legacy routes once order-based payment verification is authoritative.

## 6. Frontend component plan

Landing and dashboard:

- Rename site copy from Arc Commerce / credits to ArcVoucher / gift card vouchers in `app/layout.tsx`, `app/page.tsx`, and `components/hero.tsx`.
- Update nav behavior in `components/auth-button.tsx` and `components/credits-badge.tsx`; either remove the credit balance badge or repurpose it to an orders/vouchers summary.

User marketplace:

- `components/user-dashboard.tsx`
  - Keep auth and wallet connection flow.
  - Replace the purchase card area with:
    - `WalletStatusCard`
    - `ProductGrid`
    - `VoucherCheckoutCard`
    - `OrderHistory`

- `components/marketplace/product-grid.tsx`
  - Fetch or receive products.
  - Show loading and error states if products are not ready.
  - Use server-provided fallback only if the API is unavailable.

- `components/marketplace/product-card.tsx`
  - Render the five required seed products:
    - Amazon $10
    - Amazon $25
    - Google Play $10
    - Netflix $15
    - Steam $20
  - Show name, brand, price in USDC, stock status, and buy button.

- `components/wallet/voucher-checkout-card.tsx`
  - Replace credit-specific naming with product/order/voucher naming.
  - Show status states:
    - pending payment
    - waiting confirmation
    - paid
    - fulfilled
    - ready to reveal
    - failed/refunded
  - Keep the current USDC transfer flow to the destination wallet for the first pass.
  - Do not show success until server-side verification updates the order.

- `components/orders/order-history.tsx`
  - Replace transaction-centric user history with order-centric history.
  - Show product name, paid amount, order status, tx hash, and reveal button.

- `components/orders/voucher-reveal-dialog.tsx`
  - Fetch reveal data only when the user requests it.
  - Keep the revealed code in local component memory only.
  - Never prefetch voucher codes.

Legacy UI to update or retire:

- `components/transaction-history-table.tsx`
- `components/user-transactions-table/columns.tsx`
- `app/dashboard/[txHash]/page.tsx`
- `components/wallet/transaction-confirmation-modal.tsx`

## 7. Payment verification plan

Client flow:

1. User selects a product.
2. The app prepares a `pending` order payload with the product snapshot, user wallet address, destination address, and `chain_id`.
3. The wallet submits the USDC ERC-20 transfer to the admin destination wallet.
4. The order is created or updated with `tx_hash` immediately after the wallet returns the hash.
5. The client shows only pending or waiting-confirmation states until the server verifies payment.

Server verification:

- Primary source of truth: `app/api/circle/webhook/route.ts`.
- Match the incoming notification by `tx_hash` first, then `circle_transaction_id` if available.
- Verify:
  - amount matches `price_usdc * quantity`
  - destination address matches the configured admin wallet
  - chain is Arc Testnet / `5042002`
  - wallet address and user context match the order
- On valid payment:
  - move `orders.status` to `paid`
  - reserve exactly one `voucher_inventory` row atomically
  - if reservation succeeds, set `voucher_inventory.status = 'reserved'`, `assigned_order_id = order.id`, `orders.voucher_inventory_id`, and `orders.status = 'fulfilled'`
  - if no stock is available, leave the order at `paid` with `voucher_inventory_id = null` so admin can manually fulfill it

Idempotency:

- Repeated webhooks must not double-assign vouchers.
- If the order is already `paid`, `fulfilled`, or `revealed`, do not reserve another inventory row.
- If `voucher_inventory_id` is already present, treat later matching webhooks as no-op status reconciliation.

Legacy bypass:

- Remove or short-circuit `increment_credits` for voucher orders.
- Preserve webhook signature verification and webhook logging.
- Never log decrypted voucher data or include it in public webhook responses.

## 8. Admin dashboard plan

Keep the existing admin dashboard shell and treasury/admin-wallet tooling, but expand it with voucher marketplace operations.

Add sections or tabs for:

- Products
  - create and update product metadata
  - toggle active state
  - edit price and image

- Voucher inventory
  - add encrypted codes
  - view counts by status
  - disable bad stock
  - never list raw codes in table rows

- Orders
  - filter by `pending`, `paid`, `fulfilled`, `revealed`, `refunded`, `failed`
  - inspect tx hash, wallet address, destination address, and stock assignment state
  - surface orders that are `paid` but not `fulfilled`

- Refunds
  - mark orders as refunded after off-chain handling
  - keep refund actions admin-only
  - do not recycle a revealed voucher automatically

Recommended admin UI split:

- `components/admin/products-table.tsx`
- `components/admin/voucher-inventory-table.tsx`
- `components/admin/orders-table.tsx`
- `components/admin/refund-dialog.tsx`

## 9. Safe step-by-step implementation order

1. Add the Supabase migration for `products`, `orders`, `voucher_inventory`, and `voucher_reveal_events`, including RLS, indexes, triggers, and any helper reservation function.
2. Update `types/supabase.ts` to match the new schema and clean up stale legacy types while preserving the existing transaction models.
3. Add shared server utilities for voucher encryption/decryption and order fulfillment bookkeeping in `lib/vouchers/*` and `lib/orders/*`.
4. Add `GET /api/products` and the new `orders` API routes.
5. Refactor the current purchase card into `VoucherCheckoutCard`, keeping the wallet connection and USDC transfer flow but switching to order semantics and server-verified status updates.
6. Replace the user dashboard and landing copy with the voucher marketplace UI, product grid, order history, and reveal dialog.
7. Update the Circle webhook to verify voucher payments, reserve stock idempotently, fulfill orders, and bypass `increment_credits`.
8. Expand the admin dashboard with products, inventory, orders, and refund management while keeping admin wallet tooling intact.
9. Update `.env.example` with `VOUCHER_ENCRYPTION_KEY=` and any related admin notes.
10. Run `npm run lint` and `npm run build`, then fix TypeScript and integration issues before any follow-up polish.
