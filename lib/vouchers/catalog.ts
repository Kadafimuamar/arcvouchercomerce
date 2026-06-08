export interface VoucherProduct {
  id: string;
  name: string;
  brand: string;
  description: string | null;
  price_usdc: number;
  image_url: string | null;
  active: boolean;
  stock_count: number;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  source?: "database" | "fallback";
}

export const FALLBACK_PRODUCTS: VoucherProduct[] = [
  {
    id: "fallback-amazon-1",
    name: "Amazon Gift Card $1",
    brand: "Amazon",
    description: "Fallback catalog entry while the live product API is unavailable.",
    price_usdc: 1,
    image_url: null,
    active: true,
    stock_count: 0,
    stock_status: "out_of_stock",
    source: "fallback",
  },
  {
    id: "fallback-amazon-2",
    name: "Amazon Gift Card $2",
    brand: "Amazon",
    description: "Fallback catalog entry while the live product API is unavailable.",
    price_usdc: 2,
    image_url: null,
    active: true,
    stock_count: 0,
    stock_status: "out_of_stock",
    source: "fallback",
  },
  {
    id: "fallback-google-play-1",
    name: "Google Play Gift Card $1",
    brand: "Google Play",
    description: "Fallback catalog entry while the live product API is unavailable.",
    price_usdc: 1,
    image_url: null,
    active: true,
    stock_count: 0,
    stock_status: "out_of_stock",
    source: "fallback",
  },
  {
    id: "fallback-netflix-1",
    name: "Netflix Gift Card $1",
    brand: "Netflix",
    description: "Fallback catalog entry while the live product API is unavailable.",
    price_usdc: 1,
    image_url: null,
    active: true,
    stock_count: 0,
    stock_status: "out_of_stock",
    source: "fallback",
  },
  {
    id: "fallback-steam-2",
    name: "Steam Gift Card $2",
    brand: "Steam",
    description: "Fallback catalog entry while the live product API is unavailable.",
    price_usdc: 2,
    image_url: null,
    active: true,
    stock_count: 0,
    stock_status: "out_of_stock",
    source: "fallback",
  },
];

export function getVoucherStockStatus(
  stockCount: number
): VoucherProduct["stock_status"] {
  if (stockCount <= 0) return "out_of_stock";
  if (stockCount <= 3) return "low_stock";
  return "in_stock";
}
