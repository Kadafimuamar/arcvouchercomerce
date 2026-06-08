# ArcVoucher

ArcVoucher is an off-chain gift card voucher marketplace built on top of the original Arc Commerce sample application.

Users can sign in, browse voucher products, pay with USDC on Arc Testnet, wait for server-side payment verification, and securely reveal voucher codes after the order is fulfilled.

This project uses:

* Next.js
* React
* Supabase Auth
* Supabase Database
* Circle Developer Controlled Wallets
* Wagmi / Viem
* Arc Testnet
* Server-side voucher encryption
* Off-chain order and voucher fulfillment

> Important: this version does **not** use a smart contract. Product orders, voucher stock, fulfillment, and reveal logic are handled off-chain through Supabase and server-side payment verification.

---

## Table of Contents

* [Overview](#overview)
* [Core Flow](#core-flow)
* [Features](#features)
* [Tech Stack](#tech-stack)
* [Architecture](#architecture)
* [Voucher Security Model](#voucher-security-model)
* [Prerequisites](#prerequisites)
* [Environment Variables](#environment-variables)
* [Local Setup](#local-setup)
* [Supabase Setup](#supabase-setup)
* [Seed Voucher Stock](#seed-voucher-stock)
* [Circle Webhook Setup](#circle-webhook-setup)
* [Running the App](#running-the-app)
* [Testing the Purchase Flow](#testing-the-purchase-flow)
* [Admin Features](#admin-features)
* [Useful SQL Queries](#useful-sql-queries)
* [Troubleshooting](#troubleshooting)
* [Security Notes](#security-notes)
* [Project Scripts](#project-scripts)
* [Deployment Notes](#deployment-notes)
* [Roadmap](#roadmap)

---

## Overview

ArcVoucher converts the original credit-purchase sample app into a gift card voucher marketplace.

The marketplace currently supports demo/testnet voucher products:

| Product                   |   Price |
| ------------------------- | ------: |
| Amazon $10 Gift Card      | 10 USDC |
| Amazon $25 Gift Card      | 25 USDC |
| Google Play $10 Gift Card | 10 USDC |
| Netflix $15 Gift Card     | 15 USDC |
| Steam $20 Gift Card       | 20 USDC |

Each product can have encrypted voucher stock stored in Supabase. Users can only reveal a voucher after payment is verified and the server has assigned voucher inventory to their order.

---

## Core Flow

```text
User logs in
↓
User opens voucher catalog
↓
User selects a voucher product
↓
App creates an order with status: pending
↓
User pays exact USDC amount on Arc Testnet
↓
App stores tx_hash in the order
↓
Server verifies payment
↓
Order status becomes paid
↓
Server reserves one encrypted voucher from inventory
↓
Order status becomes fulfilled
↓
User clicks Reveal
↓
Server checks ownership and decrypts voucher
↓
Voucher code is shown only to the buyer
```

---

## Features

### User

* Email authentication through Supabase
* Voucher catalog
* Product cards with price, active status, and available stock
* USDC payment flow
* Order history
* Payment status tracking
* Secure voucher reveal after fulfillment

### Admin

* View products
* View available stock
* Add encrypted voucher inventory
* View orders
* Monitor pending, paid, fulfilled, revealed, refunded, and failed orders
* Manage voucher marketplace operations

### Backend

* Supabase-based order storage
* Supabase-based encrypted voucher inventory
* Server-side voucher encryption/decryption
* Server-side payment verification fallback
* Circle webhook support
* Idempotent fulfillment logic
* Secure reveal endpoint

---

## Tech Stack

| Layer                 | Technology                          |
| --------------------- | ----------------------------------- |
| Frontend              | Next.js, React, Tailwind CSS        |
| Auth                  | Supabase Auth                       |
| Database              | Supabase Postgres                   |
| Wallet / Chain        | Wagmi, Viem                         |
| Payment Network       | Arc Testnet                         |
| Wallet Infrastructure | Circle Developer Controlled Wallets |
| Voucher Storage       | Supabase, encrypted server-side     |
| Encryption            | AES-256-GCM                         |
| Hashing               | SHA-256                             |

---

## Architecture

```text
Frontend
├─ Voucher Catalog
├─ Checkout / Buy Button
├─ Order History
└─ Voucher Reveal UI

Backend API
├─ /api/products
├─ /api/orders
├─ /api/orders/[id]/status
├─ /api/orders/[id]/reveal
├─ /api/admin/products
├─ /api/admin/vouchers
└─ /api/circle/webhook

Supabase
├─ products
├─ orders
├─ voucher_inventory
├─ voucher_reveal_events
├─ transactions
├─ transaction_events
├─ transaction_webhook_events
└─ admin_wallets

External Services
├─ Circle Developer Controlled Wallets
├─ Arc Testnet RPC
└─ ArcScan Explorer
```

---

## Voucher Security Model

Real voucher codes must never be stored in plaintext in the database or exposed to the frontend before payment verification.

Each voucher inventory item is stored as:

```text
code_ciphertext = encrypted voucher code
code_hash       = SHA-256 hash of plaintext code
status          = available / reserved / revealed / disabled
```

The reveal flow is server-only:

```text
POST /api/orders/[id]/reveal
```

The server must verify:

1. User is authenticated.
2. Order exists.
3. Order belongs to the authenticated user.
4. Order status is `fulfilled` or `revealed`.
5. Order has `voucher_inventory_id`.
6. Voucher inventory exists.
7. Voucher is assigned to that order.
8. Voucher code can be decrypted using `VOUCHER_ENCRYPTION_KEY`.

Only after all checks pass does the server return the voucher code.

---

## Prerequisites

Install:

* Node.js 22+
* npm
* Git
* Supabase account or local Supabase CLI
* Circle Developer Controlled Wallets API key
* Circle Entity Secret
* Arc Testnet USDC for testing
* ngrok, only if testing Circle webhooks locally

Check Node:

```bash
node -v
npm -v
```

Recommended Node version:

```text
v22.x.x
```

---

## Environment Variables

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Example:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=
SUPABASE_SECRET_KEY=

# Circle
CIRCLE_API_KEY=
CIRCLE_ENTITY_SECRET=
CIRCLE_BLOCKCHAIN=ARC-TESTNET
CIRCLE_USDC_TOKEN_ID=

# Arc / Payment Verification
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_CONTRACT_ADDRESS=

# Voucher Encryption
VOUCHER_ENCRYPTION_KEY=

# Misc
ADMIN_EMAIL=admin@admin.com
```

### Generate `VOUCHER_ENCRYPTION_KEY`

Use a 32-byte random key encoded as 64 hex characters:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then add the result to `.env.local`:

```env
VOUCHER_ENCRYPTION_KEY=your_64_character_hex_key_here
```

Do not commit `.env.local`.

---

## Local Setup

Clone the repository:

```bash
git clone https://github.com/Kadafimuamar/arc-commerce.git
cd arc-commerce
```

Install dependencies:

```bash
npm install
```

Run development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## Supabase Setup

Create or connect your Supabase project.

If using Supabase Cloud:

```bash
npx supabase link --project-ref your-project-ref
npx supabase db push
```

If using local Supabase:

```bash
npx supabase start
npx supabase migration up
```

Required marketplace tables:

```text
products
orders
voucher_inventory
voucher_reveal_events
```

Existing sample tables may still exist:

```text
transactions
transaction_events
transaction_webhook_events
admin_wallets
admin_transactions
```

---

## Seed Voucher Stock

The voucher stock script adds 100 encrypted dummy voucher codes for each product:

```text
Amazon $10 Gift Card      100 vouchers
Amazon $25 Gift Card      100 vouchers
Google Play $10 Gift Card 100 vouchers
Netflix $15 Gift Card     100 vouchers
Steam $20 Gift Card       100 vouchers
```

Run:

```bash
npm run seed
```

The seed script should:

* Load `.env.local`
* Validate `VOUCHER_ENCRYPTION_KEY`
* Find existing products by name and price
* Generate dummy demo voucher codes
* Encrypt them using AES-256-GCM
* Store ciphertext in `voucher_inventory`
* Store SHA-256 hash in `code_hash`
* Set voucher status to `available`
* Update `products.stock_count`

> The generated voucher codes are for demo/testnet only. They are not real redeemable gift cards.

---

## Circle Webhook Setup

For local webhook testing, expose your local server:

```bash
ngrok http 3000
```

Copy the HTTPS ngrok URL and add this endpoint in Circle Console:

```text
https://your-ngrok-url.ngrok.io/api/circle/webhook
```

The webhook route should:

* Verify Circle signature
* Log webhook event
* Map Circle status to internal status
* Update matching transactions/orders
* Trigger order fulfillment when payment is confirmed

Local development should not depend only on webhooks. The app should also support server-side transaction verification using `tx_hash`.

---

## Running the App

Start development server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Production start:

```bash
npm run start
```

---

## Testing the Purchase Flow

1. Start the app:

```bash
npm run dev
```

2. Login with Supabase Auth.

3. Open dashboard.

4. Confirm voucher catalog shows products.

5. Confirm each product has available stock.

6. Select a product.

7. Pay exact USDC amount on Arc Testnet.

8. Wait for transaction to be mined.

9. Order should move from:

```text
Waiting Confirmation
```

to:

```text
Ready to Reveal
```

10. Click Reveal.

11. Voucher code should appear only for the rightful buyer.

---

## Admin Features

Admin access is based on:

```env
ADMIN_EMAIL=admin@admin.com
```

If the logged-in user email matches `ADMIN_EMAIL`, the dashboard should show admin features.

Admin can manage:

* Products
* Voucher stock
* Orders
* Paid orders waiting for fulfillment
* Fulfilled orders
* Revealed orders
* Refunded/failed orders

Admin should not expose voucher codes publicly.

---

## Useful SQL Queries

### Check Products

```sql
select
  id,
  name,
  brand,
  price_usdc,
  active,
  stock_count,
  created_at
from products
order by name, price_usdc;
```

### Check Voucher Stock

```sql
select
  p.name,
  p.price_usdc,
  count(vi.id) filter (where vi.status = 'available') as available_stock,
  count(vi.id) filter (where vi.status = 'reserved') as reserved_stock,
  count(vi.id) filter (where vi.status = 'revealed') as revealed_stock,
  count(vi.id) filter (where vi.status = 'disabled') as disabled_stock,
  count(vi.id) as total_stock
from products p
left join voucher_inventory vi on vi.product_id = p.id
group by p.id, p.name, p.price_usdc
order by p.name, p.price_usdc;
```

### Check Recent Orders

```sql
select
  id,
  user_id,
  product_name,
  price_usdc,
  status,
  wallet_address,
  destination_address,
  tx_hash,
  circle_transaction_id,
  voucher_inventory_id,
  created_at,
  updated_at
from orders
order by created_at desc
limit 20;
```

### Find Pending Orders

```sql
select
  id,
  product_name,
  price_usdc,
  status,
  tx_hash,
  created_at
from orders
where status = 'pending'
order by created_at desc;
```

### Find Paid Orders Without Voucher

```sql
select
  id,
  product_name,
  price_usdc,
  status,
  tx_hash,
  voucher_inventory_id,
  created_at
from orders
where status = 'paid'
  and voucher_inventory_id is null
order by created_at desc;
```

### Refresh Product Stock Count

```sql
update products p
set stock_count = s.available_stock,
    updated_at = now()
from (
  select
    product_id,
    count(*) filter (where status = 'available') as available_stock
  from voucher_inventory
  group by product_id
) s
where p.id = s.product_id;
```

---

## Troubleshooting

### 1. Product Not Found During Seed

Error:

```text
Product not found for exact match
```

Cause:

The seed script product names do not match the actual product names in Supabase.

Expected names:

```text
Amazon $10 Gift Card
Amazon $25 Gift Card
Google Play $10 Gift Card
Netflix $15 Gift Card
Steam $20 Gift Card
```

Check products:

```sql
select id, name, brand, price_usdc, active, stock_count
from products
order by name, price_usdc;
```

---

### 2. Voucher Catalog Shows Available 0

Cause:

Voucher inventory is empty or `products.stock_count` was not updated.

Run:

```bash
npm run seed
```

Then refresh stock count:

```sql
update products p
set stock_count = s.available_stock,
    updated_at = now()
from (
  select
    product_id,
    count(*) filter (where status = 'available') as available_stock
  from voucher_inventory
  group by product_id
) s
where p.id = s.product_id;
```

---

### 3. Order Stuck at Waiting Confirmation

Cause:

Payment has been submitted, but the backend has not verified the transaction.

Check latest orders:

```sql
select
  product_name,
  price_usdc,
  status,
  tx_hash,
  voucher_inventory_id,
  updated_at
from orders
order by created_at desc
limit 5;
```

If `status = pending`, the server-side verifier or webhook has not completed.

Possible fixes:

* Confirm `ARC_RPC_URL` is set.
* Confirm `ARC_USDC_CONTRACT_ADDRESS` is set.
* Confirm transaction succeeded on ArcScan.
* Confirm destination address matches the order.
* Confirm payment amount is equal or greater than product price.
* Confirm order status route is polling/refetching.

---

### 4. Reveal Button Disabled

Reveal is only available when order status is:

```text
fulfilled
revealed
```

If status is:

```text
pending
paid
failed
refunded
```

reveal remains disabled.

If order is paid but not fulfilled, there may be no available voucher stock for that product.

---

### 5. Next.js SWC / Turbopack Error on Windows

If you see:

```text
next-swc.win32-x64-msvc.node is not a valid Win32 application
turbo.createProject is not supported by the wasm bindings
```

Fix:

```powershell
taskkill /F /IM node.exe 2>$null
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
```

If needed, disable Turbopack by changing:

```json
"dev": "next dev --turbopack"
```

to:

```json
"dev": "next dev"
```

---

## Security Notes

Do not commit:

```text
.env
.env.local
.env.*.local
voucher_codes_plain_DEV_ONLY.csv
real voucher inventory
private keys
Circle API key
Circle Entity Secret
Supabase service role key
VOUCHER_ENCRYPTION_KEY
```

Recommended `.gitignore` additions:

```gitignore
.env
.env.local
.env.*.local

node_modules
.next
dist
build

voucher_codes_plain_DEV_ONLY.csv
arcvoucher_seed_bundle.zip
env.local.add-this.txt
```

Important production rules:

* Never expose `SUPABASE_SECRET_KEY` to frontend.
* Never expose `CIRCLE_API_KEY` to frontend.
* Never expose `CIRCLE_ENTITY_SECRET` to frontend.
* Never expose `VOUCHER_ENCRYPTION_KEY` to frontend.
* Never return raw `voucher_inventory` rows to users.
* Never mark orders as paid from client-side code.
* Never fake payment confirmation.
* Always verify payment server-side.
* Always verify order ownership before voucher reveal.
* Keep fulfillment idempotent to avoid double voucher assignment.

---

## Project Scripts

Common scripts:

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run seed
```

Expected seed script:

```text
tsx scripts/seed-voucher-stock.ts
```

---

## Deployment Notes

For deployment, configure environment variables in your hosting provider, for example Vercel:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SECRET_KEY
CIRCLE_API_KEY
CIRCLE_ENTITY_SECRET
CIRCLE_BLOCKCHAIN
CIRCLE_USDC_TOKEN_ID
ARC_RPC_URL
ARC_CHAIN_ID
ARC_USDC_CONTRACT_ADDRESS
VOUCHER_ENCRYPTION_KEY
ADMIN_EMAIL
```

After deployment:

1. Run Supabase migrations.
2. Seed products and voucher inventory.
3. Configure Circle webhook to:

```text
https://your-domain.com/api/circle/webhook
```

4. Test a purchase with demo voucher stock.
5. Confirm order becomes fulfilled.
6. Confirm voucher reveal works only for the buyer.

---

## Roadmap

Possible next phases:

### Phase 1 — Current MVP

* Off-chain voucher marketplace
* Circle/Supabase payment verification
* Encrypted voucher inventory
* Secure reveal

### Phase 2 — Improved Admin

* Product editor
* CSV voucher upload
* Bulk stock import
* Refund workflow
* Better order analytics

### Phase 3 — Arc App Kit / Unified Balance

* Unified Balance check
* Cross-chain USDC funding route
* Spend estimation
* User top-up guidance

### Phase 4 — AI Agent Checkout

* Chat-based voucher selection
* Agent-guided checkout
* Order status through chat
* Secure voucher reveal through chat

### Phase 5 — Smart Contract Optional

* On-chain product/order anchoring
* Event-based fulfillment
* Voucher hash anchoring
* Hybrid on-chain/off-chain marketplace

---

## License

This project is based on the original Arc Commerce sample app and has been modified into ArcVoucher, an off-chain voucher marketplace MVP.

Use this project for testnet, demo, and educational development unless production security review has been completed.
