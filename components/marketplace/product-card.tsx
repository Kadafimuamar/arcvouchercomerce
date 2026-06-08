"use client";

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
import type { VoucherProduct } from "@/lib/vouchers/catalog";

interface ProductCardProps {
  product: VoucherProduct;
  selected: boolean;
  onSelect: (product: VoucherProduct) => void;
}

const STOCK_STYLES: Record<
  VoucherProduct["stock_status"],
  { label: string; className: string }
> = {
  in_stock: {
    label: "In Stock",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100",
  },
  low_stock: {
    label: "Low Stock",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100",
  },
  out_of_stock: {
    label: "Out of Stock",
    className: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100",
  },
};

export function ProductCard({
  product,
  selected,
  onSelect,
}: ProductCardProps) {
  const stockStyle = STOCK_STYLES[product.stock_status];
  const disabled = product.stock_status === "out_of_stock";

  return (
    <Card
      className={
        selected
          ? "border-primary shadow-sm ring-1 ring-primary/30"
          : undefined
      }
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{product.name}</CardTitle>
            <CardDescription>{product.brand}</CardDescription>
          </div>
          <Badge className={stockStyle.className}>{stockStyle.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="min-h-10 text-sm text-muted-foreground">
          {product.description ?? "Digital voucher delivered after verified payment."}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Price</span>
          <span className="text-lg font-semibold">
            {product.price_usdc.toFixed(2)} USDC
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Available</span>
          <span className="font-medium">{product.stock_count}</span>
        </div>
        {product.source === "fallback" && (
          <p className="text-xs text-amber-600">
            Fallback catalog entry. Live inventory is unavailable.
          </p>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          disabled={disabled}
          variant={selected ? "default" : "outline"}
          onClick={() => onSelect(product)}
        >
          {selected ? "Selected" : "Buy"}
        </Button>
      </CardFooter>
    </Card>
  );
}
