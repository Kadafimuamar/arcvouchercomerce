"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface VoucherRevealDialogProps {
  orderId: string;
  disabled?: boolean;
}

export function VoucherRevealDialog({
  orderId,
  disabled = false,
}: VoucherRevealDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voucherCode, setVoucherCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReveal() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/orders/${orderId}/reveal`, {
        method: "POST",
      });
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || "Failed to reveal voucher code.");
      }

      setVoucherCode(json.data?.voucher_code ?? null);
      toast.success("Voucher revealed securely.");
      window.dispatchEvent(new CustomEvent("ordervoucher-updated"));
    } catch (revealError) {
      const message =
        revealError instanceof Error
          ? revealError.message
          : "Failed to reveal voucher code.";
      setError(message);
      toast.error("Reveal failed", { description: message });
    } finally {
      setLoading(false);
    }
  }

  async function copyCode() {
    if (!voucherCode) return;

    try {
      await navigator.clipboard.writeText(voucherCode);
      toast.success("Voucher code copied.");
    } catch {
      toast.error("Copy failed.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled} size="sm">
          Reveal Voucher
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reveal Voucher Code</DialogTitle>
          <DialogDescription>
            Reveal is only available after verified payment and inventory
            fulfillment.
          </DialogDescription>
        </DialogHeader>

        {!voucherCode ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This action loads the assigned voucher code from the secure server
              inventory.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={handleReveal} disabled={loading}>
              {loading ? "Revealing..." : "Reveal Securely"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/40 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Voucher Code
              </p>
              <p className="mt-2 break-all font-mono text-base">
                {voucherCode}
              </p>
            </div>
            <Button variant="outline" onClick={copyCode} className="gap-2">
              <Copy className="h-4 w-4" />
              Copy Code
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
