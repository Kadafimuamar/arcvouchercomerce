import {
  createPublicClient,
  decodeEventLog,
  erc20Abi,
  getAddress,
  http,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { SupportedChainId, CHAIN_IDS_TO_USDC_ADDRESSES } from "@/lib/chains";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { fulfillVoucherOrderPayment } from "@/lib/orders/fulfillment";
import type { Tables } from "@/types/supabase";

type OrderRow = Tables<"orders">;

const ARC_TESTNET_RPC_URL =
  process.env.ARC_RPC_URL ?? "https://rpc.testnet.arc.network";
const ARC_TESTNET_CHAIN = {
  id: SupportedChainId.ARC_TESTNET,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL],
    },
  },
} as const;
const USDC_DECIMALS = 6;

const publicClient = createPublicClient({
  chain: ARC_TESTNET_CHAIN,
  transport: http(ARC_TESTNET_RPC_URL),
});

export interface VerifyOrderPaymentResult {
  order: OrderRow;
  paymentVerified: boolean;
  reserved: boolean;
  message: string | null;
}

function getArcUsdcContractAddress(): Address {
  const configuredAddress = process.env.ARC_USDC_CONTRACT_ADDRESS?.trim();
  const fallbackAddress = CHAIN_IDS_TO_USDC_ADDRESSES[SupportedChainId.ARC_TESTNET];
  const candidate = configuredAddress || fallbackAddress;

  if (!candidate) {
    throw new Error("Arc USDC contract address is not configured.");
  }

  return getAddress(candidate);
}

function normalizeAddress(value: string | null | undefined) {
  if (!value) return null;

  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function getExpectedUsdcAmount(order: Pick<OrderRow, "price_usdc" | "quantity">) {
  return parseUnits(
    (Number(order.price_usdc) * Number(order.quantity)).toFixed(USDC_DECIMALS),
    USDC_DECIMALS
  );
}

function shouldAttemptVerification(order: OrderRow) {
  return (
    (order.status === "pending" && Boolean(order.tx_hash)) ||
    (order.status === "paid" && !order.voucher_inventory_id)
  );
}

async function loadOrder(orderId: string) {
  const { data, error } = await supabaseAdminClient
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !data) {
    throw error ?? new Error("Order not found.");
  }

  return data;
}

async function markOrderFailed(order: OrderRow, reason: string) {
  const { data, error } = await supabaseAdminClient
    .from("orders")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .in("status", ["pending", "paid"])
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Failed to update order status.");
  }

  return {
    order: data,
    paymentVerified: false,
    reserved: false,
    message: reason,
  } satisfies VerifyOrderPaymentResult;
}

async function reconcileExistingReservation(
  order: OrderRow,
  circleTransactionId?: string | null
) {
  const { data: assignedInventory, error: assignedInventoryError } =
    await supabaseAdminClient
      .from("voucher_inventory")
      .select("*")
      .eq("assigned_order_id", order.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

  if (assignedInventoryError) {
    throw assignedInventoryError;
  }

  if (!assignedInventory) {
    return null;
  }

  const nextStatus =
    order.status === "revealed" ? "revealed" : "fulfilled";
  const updates: Partial<OrderRow> = {
    circle_transaction_id:
      circleTransactionId ?? order.circle_transaction_id,
    voucher_inventory_id: assignedInventory.id,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  const { data: updatedOrder, error: updatedOrderError } =
    await supabaseAdminClient
      .from("orders")
      .update(updates)
      .eq("id", order.id)
      .select("*")
      .single();

  if (updatedOrderError || !updatedOrder) {
    throw updatedOrderError ?? new Error("Failed to reconcile order fulfillment.");
  }

  return {
    order: updatedOrder,
    paymentVerified: true,
    reserved: true,
    message: null,
  } satisfies VerifyOrderPaymentResult;
}

function getTransferMatches({
  logs,
  walletAddress,
  destinationAddress,
  expectedAmount,
  usdcContractAddress,
}: {
  logs: { address: Address; topics: readonly Hex[]; data: Hex }[];
  walletAddress: Address | null;
  destinationAddress: Address;
  expectedAmount: bigint;
  usdcContractAddress: Address;
}) {
  return logs
    .filter(
      (log) =>
        getAddress(log.address) === usdcContractAddress
    )
    .map((log) => {
      if (log.topics.length === 0) {
        return null;
      }

      try {
        return decodeEventLog({
          abi: erc20Abi,
          data: log.data,
          topics: log.topics as [Hex, ...Hex[]],
        });
      } catch {
        return null;
      }
    })
    .filter(
      (
        decoded
      ): decoded is {
        eventName: "Transfer";
        args: { from: Address; to: Address; value: bigint };
      } =>
        decoded?.eventName === "Transfer" &&
        typeof decoded.args === "object" &&
        decoded.args !== null &&
        "from" in decoded.args &&
        "to" in decoded.args &&
        "value" in decoded.args
    )
    .filter((decoded) => {
      const from = getAddress(decoded.args.from);
      const to = getAddress(decoded.args.to);
      const value = decoded.args.value;

      if (to !== destinationAddress) {
        return false;
      }

      if (walletAddress && from !== walletAddress) {
        return false;
      }

      return value >= expectedAmount;
    });
}

export async function verifyOrderPayment({
  orderId,
  userId,
  order: initialOrder,
  circleTransactionId,
}: {
  orderId: string;
  userId?: string;
  order?: OrderRow;
  circleTransactionId?: string | null;
}): Promise<VerifyOrderPaymentResult> {
  let order = initialOrder ?? (await loadOrder(orderId));

  if (userId && order.user_id !== userId) {
    throw new Error("Order not found.");
  }

  if (order.status === "fulfilled" || order.status === "revealed") {
    return {
      order,
      paymentVerified: true,
      reserved: Boolean(order.voucher_inventory_id),
      message: null,
    };
  }

  if (order.status === "refunded" || order.status === "failed") {
    return {
      order,
      paymentVerified: order.status !== "failed",
      reserved: Boolean(order.voucher_inventory_id),
      message: null,
    };
  }

  const reconciledReservation = await reconcileExistingReservation(
    order,
    circleTransactionId
  );
  if (reconciledReservation) {
    return reconciledReservation;
  }

  if (order.status === "paid" && !order.voucher_inventory_id) {
    const fulfillment = await fulfillVoucherOrderPayment({
      order,
      circleTransactionId,
    });

    return {
      order: fulfillment.order,
      paymentVerified: true,
      reserved: fulfillment.reserved,
      message: fulfillment.reserved
        ? null
        : "Payment verified, waiting for voucher stock",
    };
  }

  if (!shouldAttemptVerification(order)) {
    return {
      order,
      paymentVerified: false,
      reserved: false,
      message: order.tx_hash ? "waiting_confirmation" : "pending_payment",
    };
  }

  if (!order.tx_hash) {
    return {
      order,
      paymentVerified: false,
      reserved: false,
      message: "waiting_confirmation",
    };
  }

  if (order.chain_id !== SupportedChainId.ARC_TESTNET) {
    return markOrderFailed(order, "Order was created on an unsupported chain.");
  }

  const destinationAddress = normalizeAddress(order.destination_address);
  if (!destinationAddress) {
    return markOrderFailed(
      order,
      "Destination address is missing or invalid for payment verification."
    );
  }

  const walletAddress = normalizeAddress(order.wallet_address);
  const receipt = await publicClient
    .getTransactionReceipt({ hash: order.tx_hash as Hex })
    .catch((error) => {
      if (error instanceof Error) {
        return null;
      }
      throw error;
    });

  if (!receipt) {
    return {
      order,
      paymentVerified: false,
      reserved: false,
      message: "waiting_confirmation",
    };
  }

  if (receipt.status !== "success") {
    return markOrderFailed(order, "Transaction reverted on-chain.");
  }

  const expectedAmount = getExpectedUsdcAmount(order);
  const usdcContractAddress = getArcUsdcContractAddress();
  const matchingTransfers = getTransferMatches({
    logs: receipt.logs as {
      address: Address;
      topics: readonly Hex[];
      data: Hex;
    }[],
    walletAddress,
    destinationAddress,
    expectedAmount,
    usdcContractAddress,
  });

  if (matchingTransfers.length === 0) {
    return markOrderFailed(
      order,
      "No matching USDC transfer was found for this order."
    );
  }

  const fulfillment = await fulfillVoucherOrderPayment({
    order,
    circleTransactionId,
  });

  order = fulfillment.order;

  return {
    order,
    paymentVerified: true,
    reserved: fulfillment.reserved,
    message: fulfillment.reserved
      ? null
      : "Payment verified, waiting for voucher stock",
  };
}
