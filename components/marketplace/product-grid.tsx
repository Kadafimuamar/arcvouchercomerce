"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { VoucherProduct } from "@/lib/vouchers/catalog";
import { ProductCard } from "@/components/marketplace/product-card";

interface ProductGridProps {
  selectedProductId?: string | null;
  onSelectProduct: (product: VoucherProduct) => void;
}

export function ProductGrid({
  selectedProductId,
  onSelectProduct,
}: ProductGridProps) {
  const [products, setProducts] = useState<VoucherProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/products");
        const json = await response.json();

        if (!response.ok) {
          throw new Error(json.error || "Failed to load voucher products.");
        }

        if (cancelled) return;
        setProducts((json.data as VoucherProduct[]) ?? []);
        setWarning(typeof json.warning === "string" ? json.warning : null);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load voucher products."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="w-full space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Voucher Catalog
        </h2>
        <p className="text-sm text-muted-foreground">
          Choose a gift card voucher, then pay the exact USDC amount on Arc
          Testnet.
        </p>
      </div>

      {warning && (
        <Alert>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="text-sm text-muted-foreground">
          Loading voucher products...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              selected={selectedProductId === product.id}
              onSelect={onSelectProduct}
            />
          ))}
        </div>
      )}
    </section>
  );
}
