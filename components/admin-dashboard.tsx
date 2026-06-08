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

import type { Database } from "@/types/supabase";
import type { AdminTransaction } from "@/types/admin-transaction";
import { createClient } from "@supabase/supabase-js";
import { AdminWalletsTable } from "@/components/admin-wallets-table/table";
import { columns as walletColumns } from "@/components/admin-wallets-table/columns";
import { AdminTransactionsTable } from "@/components/admin-transactions-table/table";
import { columns as transactionColumns } from "@/components/admin-transactions-table/columns";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export async function AdminDashboard() {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  );

  // First fetch admin wallets to get their addresses
  const { data: wallets, error: walletsError } = await supabaseAdmin
    .from("admin_wallets")
    .select("*")
    .order("created_at", { ascending: false });

  if (walletsError) {
    console.error("Error fetching admin wallets:", walletsError.message);
  }

  const adminWalletAddresses = wallets?.map(w => w.address) ?? [];

  // Fetch all transactions and filter on the server side
  const { data: allTransactions, error: transactionsError } = await supabaseAdmin
    .from("transactions")
    .select("*, source_wallet:admin_wallets(label)")
    .order("created_at", { ascending: false });

  if (transactionsError) {
    console.error("Error fetching admin transactions:", transactionsError.message);
  }

  // Filter: include non-USER transactions OR USER transactions sent to admin wallets
  const transactions = allTransactions?.filter(tx => {
    const isAdminTransaction = tx.transaction_type !== "USER";
    const isUserToAdminWallet =
      tx.transaction_type === "USER" &&
      tx.destination_address &&
      adminWalletAddresses.includes(tx.destination_address);
    return isAdminTransaction || isUserToAdminWallet;
  }) ?? [];

  const [{ data: products }, { data: orders }, { data: inventory }] =
    await Promise.all([
      supabaseAdmin
        .from("products")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20),
      supabaseAdmin
        .from("voucher_inventory")
        .select("id, product_id, status"),
    ]);

  const inventoryByProduct = (inventory ?? []).reduce<
    Record<string, { available: number; reserved: number; revealed: number; disabled: number }>
  >((acc, item) => {
    if (!acc[item.product_id]) {
      acc[item.product_id] = {
        available: 0,
        reserved: 0,
        revealed: 0,
        disabled: 0,
      };
    }
    acc[item.product_id][item.status] += 1;
    return acc;
  }, {});

  return (
    <div className="w-full space-y-8">
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground mt-2">
          Platform operator dashboard for wallets, voucher products, stock, and
          order fulfillment.
        </p>
      </div>

      <AdminWalletsTable columns={walletColumns} data={wallets ?? []} />
      <AdminTransactionsTable columns={transactionColumns} initialData={transactions as AdminTransaction[] ?? []} />

      <div className="grid gap-8 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Voucher Products</CardTitle>
            <CardDescription>
              Product pricing and current available inventory counts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No voucher products found.
                    </TableCell>
                  </TableRow>
                ) : (
                  (products ?? []).map((product) => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {product.brand}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{Number(product.price_usdc).toFixed(2)} USDC</TableCell>
                      <TableCell>
                        <Badge variant={product.active ? "default" : "outline"}>
                          {product.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{inventoryByProduct[product.id]?.available ?? product.stock_count}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voucher Inventory</CardTitle>
            <CardDescription>
              Reserved and revealed counts are shown without exposing voucher
              codes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Revealed</TableHead>
                  <TableHead>Disabled</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(products ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No inventory summary available yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  (products ?? []).map((product) => {
                    const summary = inventoryByProduct[product.id] ?? {
                      available: 0,
                      reserved: 0,
                      revealed: 0,
                      disabled: 0,
                    };
                    return (
                      <TableRow key={product.id}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{summary.available}</TableCell>
                        <TableCell>{summary.reserved}</TableCell>
                        <TableCell>{summary.revealed}</TableCell>
                        <TableCell>{summary.disabled}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Voucher Orders</CardTitle>
          <CardDescription>
            Orders that are paid but not fulfilled need manual fulfillment
            attention.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Tx Hash</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No voucher orders found.
                  </TableCell>
                </TableRow>
              ) : (
                (orders ?? []).map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.product_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={order.status === "paid" ? "secondary" : "outline"}
                      >
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.wallet_address
                        ? `${order.wallet_address.slice(0, 8)}...${order.wallet_address.slice(-6)}`
                        : "N/A"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {order.tx_hash
                        ? `${order.tx_hash.slice(0, 8)}...${order.tx_hash.slice(-6)}`
                        : "Pending"}
                    </TableCell>
                    <TableCell>
                      {new Date(order.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
