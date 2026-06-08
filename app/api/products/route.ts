import { NextResponse } from "next/server";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  FALLBACK_PRODUCTS,
  getVoucherStockStatus,
} from "@/lib/vouchers/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await supabaseAdminClient
      .from("products")
      .select("id, name, brand, description, price_usdc, image_url, active, stock_count")
      .eq("active", true)
      .order("price_usdc", { ascending: true });

    if (error) {
      console.error("[products] Failed to load products:", error.message);
      return NextResponse.json(
        {
          data: FALLBACK_PRODUCTS,
          source: "fallback",
          warning: "Live product catalog unavailable. Showing fallback catalog.",
        },
        { status: 200 }
      );
    }

    const rows =
      data?.map((product) => ({
        ...product,
        price_usdc: Number(product.price_usdc),
        stock_status: getVoucherStockStatus(product.stock_count),
        source: "database" as const,
      })) ?? [];

    if (rows.length === 0) {
      return NextResponse.json(
        {
          data: FALLBACK_PRODUCTS,
          source: "fallback",
          warning: "No live products found yet. Showing fallback catalog.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ data: rows, source: "database" }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[products] Unexpected error:", message);
    return NextResponse.json(
      {
        data: FALLBACK_PRODUCTS,
        source: "fallback",
        warning: "Unexpected catalog error. Showing fallback catalog.",
      },
      { status: 200 }
    );
  }
}
