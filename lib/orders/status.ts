export const ORDER_STATUSES = [
  "pending",
  "paid",
  "fulfilled",
  "revealed",
  "refunded",
  "failed",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderStatusView {
  label: string;
  tone:
    | "default"
    | "secondary"
    | "destructive"
    | "outline";
  detail: string;
}

export function getOrderStatusView(status: OrderStatus, hasTxHash: boolean): OrderStatusView {
  if (status === "pending" && !hasTxHash) {
    return {
      label: "Pending Payment",
      tone: "secondary",
      detail: "Create the order, then submit the USDC transfer from your wallet.",
    };
  }

  if (status === "pending" && hasTxHash) {
    return {
      label: "Waiting Confirmation",
      tone: "secondary",
      detail: "The transfer was submitted. Server-side verification is still pending.",
    };
  }

  switch (status) {
    case "paid":
      return {
        label: "Paid",
        tone: "outline",
        detail: "Payment verified, waiting for voucher stock.",
      };
    case "fulfilled":
      return {
        label: "Ready to Reveal",
        tone: "default",
        detail: "A voucher has been reserved for this order.",
      };
    case "revealed":
      return {
        label: "Revealed",
        tone: "default",
        detail: "The voucher code has already been revealed to the buyer.",
      };
    case "refunded":
      return {
        label: "Refunded",
        tone: "destructive",
        detail: "This order was refunded by an administrator.",
      };
    case "failed":
      return {
        label: "Failed",
        tone: "destructive",
        detail: "The transfer could not be verified.",
      };
    default:
      return {
        label: "Pending Payment",
        tone: "secondary",
        detail: "Waiting for payment to start.",
      };
  }
}

export function isRevealableStatus(status: OrderStatus) {
  return status === "fulfilled" || status === "revealed";
}

export function isTerminalOrderStatus(status: OrderStatus) {
  return status === "revealed" || status === "refunded" || status === "failed";
}
