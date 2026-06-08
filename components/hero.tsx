/**
 * Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export function Hero() {
  return (
    <div className="flex flex-col gap-8 items-center text-center">
      <h1 className="sr-only">ArcVoucher</h1>
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        ArcVoucher Marketplace
      </p>
      <p className="text-3xl lg:text-5xl leading-tight! mx-auto max-w-3xl text-center">
        Buy digital gift card vouchers with{" "}
        <a
          href="https://supabase.com/?utm_source=create-next-app&utm_medium=template&utm_term=nextjs"
          target="_blank"
          className="font-bold hover:underline"
          rel="noreferrer"
        >
          USDC
        </a>{" "}
        and{" "}
        <a
          href="https://www.circle.com/wallets"
          target="_blank"
          className="font-bold hover:underline"
          rel="noreferrer"
        >
          Circle Wallets
        </a>
        , then reveal codes only after secure server-side verification.
      </p>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Sign in, connect a wallet on Arc Testnet, pay the exact USDC amount,
        and let the server reserve voucher inventory before reveal.
      </p>
    </div>
  );
}
