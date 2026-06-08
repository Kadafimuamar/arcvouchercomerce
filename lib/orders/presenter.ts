import { isRevealableStatus, getOrderStatusView } from "@/lib/orders/status";
import type { Tables } from "@/types/supabase";

type OrderRow = Tables<"orders">;

export function serializeOrder(order: OrderRow) {
  return {
    ...order,
    price_usdc: Number(order.price_usdc),
    reveal_available:
      isRevealableStatus(order.status) && Boolean(order.voucher_inventory_id),
    status_view: getOrderStatusView(order.status, Boolean(order.tx_hash)),
  };
}

