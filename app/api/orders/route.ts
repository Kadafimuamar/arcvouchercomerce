import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { serializeOrder } from "@/lib/orders/presenter";
import { verifyOrderPayment } from "@/lib/orders/verification";
import { SupportedChainId } from "@/lib/chains";
import type { Tables } from "@/types/supabase";

type ProductRow = Tables<"products">;
type OrderRow = Tables<"orders">;

async function requireUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

async function getActiveProduct(productId: string): Promise<ProductRow | null> {
  const { data, error } = await supabaseAdminClient
    .from("products")
    .select("*")
    .eq("id", productId)
    .eq("active", true)
    .single();

  if (error) {
    return null;
  }

  return data;
}

export async function GET() {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdminClient
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load orders", details: error.message },
        { status: 500 }
      );
    }

    const hydratedOrders = await Promise.all(
      (data ?? []).map(async (order) => {
        const needsVerification =
          (order.status === "pending" && Boolean(order.tx_hash)) ||
          (order.status === "paid" && !order.voucher_inventory_id);

        if (!needsVerification) {
          return order;
        }

        try {
          const result = await verifyOrderPayment({
            orderId: order.id,
            userId: user.id,
            order,
          });
          return result.order;
        } catch {
          return order;
        }
      })
    );

    return NextResponse.json({ data: hydratedOrders.map(serializeOrder) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      orderId,
      productId,
      quantity = 1,
      walletAddress,
      destinationAddress,
      txHash,
      chainId,
    } = body ?? {};

    if (typeof productId !== "string" || !productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    if (quantity !== 1) {
      return NextResponse.json(
        { error: "Only quantity=1 is supported for voucher orders." },
        { status: 400 }
      );
    }

    if (typeof chainId !== "number") {
      return NextResponse.json(
        { error: "chainId is required" },
        { status: 400 }
      );
    }

    if (chainId !== SupportedChainId.ARC_TESTNET) {
      return NextResponse.json(
        { error: "Voucher orders are currently supported only on Arc Testnet." },
        { status: 400 }
      );
    }

    const product = await getActiveProduct(productId);
    if (!product) {
      return NextResponse.json(
        { error: "Product not found or inactive" },
        { status: 404 }
      );
    }

    if (orderId) {
      if (typeof orderId !== "string") {
        return NextResponse.json(
          { error: "orderId must be a string" },
          { status: 400 }
        );
      }

      if (typeof txHash !== "string" || !txHash.startsWith("0x")) {
        return NextResponse.json(
          { error: "A valid txHash is required when updating an existing order." },
          { status: 400 }
        );
      }

      const { data: existingOrder, error: existingOrderError } =
        await supabaseAdminClient
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .eq("user_id", user.id)
          .single();

      if (existingOrderError || !existingOrder) {
        return NextResponse.json(
          { error: "Order not found" },
          { status: 404 }
        );
      }

      if (existingOrder.status !== "pending") {
        return NextResponse.json(
          {
            error: "Only pending orders can be updated from the checkout flow.",
            order: serializeOrder(existingOrder),
          },
          { status: 409 }
        );
      }

      const { data: updatedOrder, error: updateError } =
        await supabaseAdminClient
          .from("orders")
          .update({
            wallet_address:
              typeof walletAddress === "string" ? walletAddress : existingOrder.wallet_address,
            destination_address:
              typeof destinationAddress === "string"
                ? destinationAddress
                : existingOrder.destination_address,
            tx_hash: txHash,
            chain_id: chainId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId)
          .eq("user_id", user.id)
          .select("*")
          .single();

      if (updateError || !updatedOrder) {
        return NextResponse.json(
          { error: "Failed to update order", details: updateError?.message },
          { status: 500 }
        );
      }

      let resolvedOrder: OrderRow = updatedOrder;

      try {
        const verification = await verifyOrderPayment({
          orderId: updatedOrder.id,
          userId: user.id,
          order: updatedOrder,
        });
        resolvedOrder = verification.order;
      } catch {
        resolvedOrder = updatedOrder;
      }

      return NextResponse.json({ data: serializeOrder(resolvedOrder) }, { status: 200 });
    }

    const insertPayload: Tables<"orders"> extends never ? never : {
      user_id: string;
      product_id: string;
      product_name: string;
      price_usdc: number;
      quantity: number;
      wallet_address: string | null;
      destination_address: string | null;
      chain_id: number;
      status: "pending";
      tx_hash: string | null;
    } = {
      user_id: user.id,
      product_id: product.id,
      product_name: product.name,
      price_usdc: Number(product.price_usdc),
      quantity,
      wallet_address: typeof walletAddress === "string" ? walletAddress : null,
      destination_address:
        typeof destinationAddress === "string" ? destinationAddress : null,
      chain_id: chainId,
      status: "pending",
      tx_hash: typeof txHash === "string" ? txHash : null,
    };

    const { data: createdOrder, error: createError } = await supabaseAdminClient
      .from("orders")
      .insert(insertPayload)
      .select("*")
      .single();

    if (createError || !createdOrder) {
      return NextResponse.json(
        { error: "Failed to create order", details: createError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: serializeOrder(createdOrder) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
