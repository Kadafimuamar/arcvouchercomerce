"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VoucherRevealDialog } from "@/components/orders/voucher-reveal-dialog";
import { getOrderStatusView, isRevealableStatus } from "@/lib/orders/status";
import type { OrderStatusView } from "@/lib/orders/status";

interface OrderRecord {
  id: string;
  product_name: string;
  price_usdc: number;
  quantity: number;
  status:
    | "pending"
    | "paid"
    | "fulfilled"
    | "revealed"
    | "refunded"
    | "failed";
  tx_hash: string | null;
  created_at: string;
  reveal_available: boolean;
  status_view?: OrderStatusView;
}

export function OrderHistory() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function loadOrders() {
      try {
        const response = await fetch("/api/orders");
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Failed to load orders.");
        }

        if (cancelled) return;
        const loadedOrders = (json.data as OrderRecord[]) ?? [];
        const ordersNeedingRefresh = loadedOrders.filter(
          (order) =>
            (order.status === "pending" && Boolean(order.tx_hash)) ||
            (order.status === "paid" && !order.reveal_available)
        );

        if (ordersNeedingRefresh.length === 0) {
          setOrders(loadedOrders);
          setError(null);
          return;
        }

        const refreshedOrders = await Promise.all(
          loadedOrders.map(async (order) => {
            const shouldRefresh =
              (order.status === "pending" && Boolean(order.tx_hash)) ||
              (order.status === "paid" && !order.reveal_available);

            if (!shouldRefresh) {
              return order;
            }

            try {
              const statusResponse = await fetch(`/api/orders/${order.id}/status`);
              const statusJson = await statusResponse.json();

              if (!statusResponse.ok) {
                return order;
              }

              return (statusJson.data as OrderRecord) ?? order;
            } catch {
              return order;
            }
          })
        );

        setOrders(refreshedOrders);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error ? loadError.message : "Failed to load orders."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadOrders();
    intervalId = setInterval(loadOrders, 10000);

    const onOrderUpdated = () => {
      loadOrders();
    };

    window.addEventListener("ordervoucher-updated", onOrderUpdated);

    return () => {
      cancelled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
      window.removeEventListener("ordervoucher-updated", onOrderUpdated);
    };
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your Orders</CardTitle>
        <CardDescription>
          Track payment verification, fulfillment, and secure reveal status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No voucher orders yet. Choose a product to begin checkout.
          </p>
        ) : (
          orders.map((order) => {
            const statusView =
              order.status_view ??
              getOrderStatusView(order.status, Boolean(order.tx_hash));
            return (
              <div key={order.id} className="rounded-lg border p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <p className="font-semibold">{order.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.price_usdc.toFixed(2)} USDC
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ordered {new Date(order.created_at).toLocaleString()}
                    </p>
                    {order.tx_hash && (
                      <p className="font-mono text-xs text-muted-foreground">
                        Tx: {order.tx_hash.slice(0, 10)}...{order.tx_hash.slice(-8)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start gap-2 md:items-end">
                    <Badge variant={statusView.tone}>{statusView.label}</Badge>
                    <p className="max-w-xs text-xs text-muted-foreground md:text-right">
                      {statusView.detail}
                    </p>
                    {isRevealableStatus(order.status) ? (
                      <VoucherRevealDialog
                        orderId={order.id}
                        disabled={!order.reveal_available}
                      />
                    ) : (
                      <Button size="sm" variant="outline" disabled>
                        Reveal Unavailable
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
