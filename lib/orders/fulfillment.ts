import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import type { Tables } from "@/types/supabase";

type OrderRow = Tables<"orders">;

function toNumericAmount(amount: unknown) {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") {
    const parsed = Number(amount);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeBlockchain(blockchain: string | undefined) {
  return blockchain?.toUpperCase().replace(/_/g, "-") ?? null;
}

export async function fulfillVoucherOrderPayment({
  order,
  circleTransactionId,
}: {
  order: OrderRow;
  circleTransactionId?: string | null;
}) {
  if (order.status === "fulfilled" || order.status === "revealed") {
    return {
      order,
      reservedInventoryId: order.voucher_inventory_id,
      reserved: Boolean(order.voucher_inventory_id),
    };
  }

  const paidUpdate = await supabaseAdminClient
    .from("orders")
    .update({
      circle_transaction_id: circleTransactionId ?? order.circle_transaction_id,
      status: "paid",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("status", ["pending", "paid"])
    .select("*")
    .single();

  if (paidUpdate.error || !paidUpdate.data) {
    throw paidUpdate.error ?? new Error("Failed to update order payment status.");
  }

  const { data: existingAssignedInventory, error: existingAssignedInventoryError } =
    await supabaseAdminClient
      .from("voucher_inventory")
      .select("id")
      .eq("assigned_order_id", order.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (existingAssignedInventoryError) {
    throw existingAssignedInventoryError;
  }

  if (existingAssignedInventory?.id) {
    const fulfilledFromExisting = await supabaseAdminClient
      .from("orders")
      .update({
        circle_transaction_id:
          circleTransactionId ?? paidUpdate.data.circle_transaction_id,
        voucher_inventory_id: existingAssignedInventory.id,
        status: "fulfilled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id)
      .select("*")
      .single();

    if (fulfilledFromExisting.error || !fulfilledFromExisting.data) {
      throw (
        fulfilledFromExisting.error ??
        new Error("Failed to reconcile existing voucher assignment.")
      );
    }

    return {
      order: fulfilledFromExisting.data,
      reservedInventoryId: existingAssignedInventory.id,
      reserved: true,
    };
  }

  if (paidUpdate.data.voucher_inventory_id) {
    return {
      order: paidUpdate.data,
      reservedInventoryId: paidUpdate.data.voucher_inventory_id,
      reserved: true,
    };
  }

  const reserveResult = await supabaseAdminClient.rpc("reserve_voucher_inventory", {
    order_id_to_assign: order.id,
    product_id_to_reserve: order.product_id,
  });

  if (reserveResult.error) {
    throw reserveResult.error;
  }

  const reservedInventoryId = reserveResult.data as string | null;
  if (!reservedInventoryId) {
    return {
      order: paidUpdate.data,
      reservedInventoryId: null,
      reserved: false,
    };
  }

  const fulfilledUpdate = await supabaseAdminClient
    .from("orders")
    .update({
      circle_transaction_id: circleTransactionId ?? paidUpdate.data.circle_transaction_id,
      voucher_inventory_id: reservedInventoryId,
      status: "fulfilled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("status", ["pending", "paid", "fulfilled"])
    .select("*")
    .single();

  if (fulfilledUpdate.error || !fulfilledUpdate.data) {
    throw fulfilledUpdate.error ?? new Error("Failed to mark order fulfilled.");
  }

  return {
    order: fulfilledUpdate.data,
    reservedInventoryId,
    reserved: true,
  };
}

export function doesNotificationAmountMatchOrder(
  amounts: unknown,
  order: Pick<OrderRow, "price_usdc" | "quantity">
) {
  if (!Array.isArray(amounts) || amounts.length === 0) {
    return true;
  }

  const firstAmount = toNumericAmount(amounts[0]);
  if (firstAmount === null) {
    return true;
  }

  const expected = Number(order.price_usdc) * order.quantity;
  return Math.abs(firstAmount - expected) < 0.000001;
}

export function doesNotificationChainMatchOrder(
  blockchain: string | undefined,
  order: Pick<OrderRow, "chain_id">
) {
  const normalized = normalizeBlockchain(blockchain);
  if (!normalized) return true;
  return normalized === "ARC-TESTNET" && order.chain_id === 5042002;
}
