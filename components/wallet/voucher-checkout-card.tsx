"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BaseError, erc20Abi } from "viem";
import { useAccount, useChainId, useWriteContract } from "wagmi";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrderStatusView } from "@/lib/orders/status";
import type { VoucherProduct } from "@/lib/vouchers/catalog";
import { useUsdcBalance } from "@/lib/wagmi/useUsdcBalance";

interface VoucherCheckoutCardProps {
  selectedProduct: VoucherProduct | null;
}

interface OrderRecord {
  id: string;
  chain_id: number;
  created_at: string;
  destination_address: string | null;
  price_usdc: number;
  product_id: string;
  product_name: string;
  quantity: number;
  reveal_available: boolean;
  status:
    | "pending"
    | "paid"
    | "fulfilled"
    | "revealed"
    | "refunded"
    | "failed";
  tx_hash: string | null;
  voucher_inventory_id: string | null;
  wallet_address: string | null;
}

export function VoucherCheckoutCard({
  selectedProduct,
}: VoucherCheckoutCardProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const {
    usdcAddress,
    balance,
    hasBalance,
    isLoading: isBalanceLoading,
  } = useUsdcBalance();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [destination, setDestination] = useState<`0x${string}` | undefined>();
  const [isLoadingDestination, setIsLoadingDestination] = useState(true);
  const [currentOrder, setCurrentOrder] = useState<OrderRecord | null>(null);

  useEffect(() => {
    async function fetchDestinationWallet() {
      try {
        setIsLoadingDestination(true);
        const response = await fetch("/api/destination-wallet");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to fetch destination wallet");
        }
        setDestination(data.address);
      } catch (error) {
        toast.error("Configuration Error", {
          description:
            error instanceof Error
              ? error.message
              : "Could not load the destination address.",
        });
      } finally {
        setIsLoadingDestination(false);
      }
    }

    fetchDestinationWallet();
  }, []);

  useEffect(() => {
    if (
      !currentOrder?.id ||
      !(
        (currentOrder.status === "pending" && Boolean(currentOrder.tx_hash)) ||
        (currentOrder.status === "paid" && !currentOrder.voucher_inventory_id)
      )
    ) {
      return;
    }

    let cancelled = false;
    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${currentOrder.id}/status`);
        const json = await response.json();
        if (!response.ok || cancelled) return;

        setCurrentOrder(json.data as OrderRecord);
        window.dispatchEvent(new CustomEvent("ordervoucher-updated"));
      } catch {
        // Polling is best-effort.
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [
    currentOrder?.id,
    currentOrder?.status,
    currentOrder?.tx_hash,
    currentOrder?.voucher_inventory_id,
  ]);

  const requiredUsdc = selectedProduct?.price_usdc ?? 0;
  const requiredUsdcMicro = useMemo(() => {
    const micro = Math.round(requiredUsdc * 1_000_000);
    return BigInt(micro);
  }, [requiredUsdc]);

  const hasSufficientBalance =
    hasBalance && balance !== null ? balance >= requiredUsdcMicro : false;

  const buttonDisabled =
    !selectedProduct ||
    selectedProduct.stock_status === "out_of_stock" ||
    !isConnected ||
    !destination ||
    !usdcAddress ||
    isSubmitting ||
    isBalanceLoading ||
    !hasSufficientBalance;

  async function createPendingOrder() {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: selectedProduct?.id,
        walletAddress: address,
        destinationAddress: destination,
        chainId,
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Failed to create pending order.");
    }

    return json.data as OrderRecord;
  }

  async function attachTransactionToOrder(orderId: string, txHash: string) {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        productId: selectedProduct?.id,
        walletAddress: address,
        destinationAddress: destination,
        txHash,
        chainId,
      }),
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error || "Failed to save order transaction hash.");
    }

    return json.data as OrderRecord;
  }

  async function handleCheckout() {
    if (!selectedProduct) {
      toast.error("Choose a voucher first.");
      return;
    }
    if (!isConnected || !address) {
      toast.error("Not connected", {
        description: "Connect your wallet first.",
      });
      return;
    }
    if (!destination) {
      toast.error("Configuration error", {
        description: "Destination address missing.",
      });
      return;
    }
    if (!usdcAddress) {
      toast.error("Unsupported network", {
        description: "USDC is not supported on the current chain.",
      });
      return;
    }
    if (!hasSufficientBalance) {
      toast.error("Insufficient balance", {
        description: "Your USDC balance is too low for this voucher purchase.",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const pendingOrder = await createPendingOrder();
      setCurrentOrder(pendingOrder);
      window.dispatchEvent(new CustomEvent("ordervoucher-updated"));

      const txHash = await writeContractAsync({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: "transfer",
        args: [destination, requiredUsdcMicro],
      });

      toast.success("USDC transfer submitted", {
        description: `Hash: ${txHash.slice(0, 10)}...`,
      });

      const updatedOrder = await attachTransactionToOrder(pendingOrder.id, txHash);
      setCurrentOrder(updatedOrder);
      window.dispatchEvent(new CustomEvent("ordervoucher-updated"));
    } catch (error) {
      const message =
        error instanceof BaseError
          ? error.shortMessage
          : error instanceof Error
            ? error.message
            : "Voucher checkout failed unexpectedly.";
      toast.error("Checkout failed", { description: message });
    } finally {
      setIsSubmitting(false);
    }
  }

  const statusView = currentOrder
    ? getOrderStatusView(currentOrder.status, Boolean(currentOrder.tx_hash))
    : getOrderStatusView("pending", false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voucher Checkout</CardTitle>
        <CardDescription>
          Pay the exact voucher amount in USDC. Orders stay pending until
          server-side verification succeeds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">Selected Product</p>
          {selectedProduct ? (
            <div className="mt-2 space-y-1">
              <p className="font-semibold">{selectedProduct.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedProduct.brand}
              </p>
              <p className="text-lg font-semibold">
                {selectedProduct.price_usdc.toFixed(2)} USDC
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Pick a voucher product from the catalog to continue.
            </p>
          )}
        </div>

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Order Status</p>
              <p className="font-medium">{statusView.detail}</p>
            </div>
            <Badge variant={statusView.tone}>{statusView.label}</Badge>
          </div>
          {currentOrder?.tx_hash && (
            <p className="mt-3 font-mono text-xs text-muted-foreground">
              Tx: {currentOrder.tx_hash.slice(0, 10)}...
              {currentOrder.tx_hash.slice(-8)}
            </p>
          )}
        </div>

        <div className="space-y-1 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">USDC Required</span>
            <span className="font-medium">
              {selectedProduct ? selectedProduct.price_usdc.toFixed(2) : "0.00"} USDC
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Destination Wallet</span>
            <span className="font-mono text-xs">
              {destination
                ? `${destination.slice(0, 8)}...${destination.slice(-6)}`
                : "Loading"}
            </span>
          </div>
          {!hasSufficientBalance && isConnected && !isBalanceLoading && (
            <p className="pt-2 text-xs text-amber-600">
              Your wallet does not currently have enough USDC for this voucher.
            </p>
          )}
          {isLoadingDestination && (
            <p className="pt-2 text-xs text-muted-foreground">
              Loading destination wallet...
            </p>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full gap-2"
          onClick={handleCheckout}
          disabled={buttonDisabled}
        >
          <Image src="/usdc-logo.svg" alt="USDC" width={20} height={20} />
          {isSubmitting ? "Processing..." : "Pay with USDC"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <Link
            className="font-semibold underline"
            href="https://www.circle.com"
            target="_blank"
          >
            Circle
          </Link>{" "}
          on Arc Testnet.
        </p>
      </CardFooter>
    </Card>
  );
}
