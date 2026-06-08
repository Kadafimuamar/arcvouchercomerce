import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { verifyOrderPayment } from "@/lib/orders/verification";
import {
  decryptVoucherCode,
  isVoucherEncryptionConfigured,
} from "@/lib/vouchers/encryption";

function hashIp(value: string | null) {
  if (!value) return null;
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isVoucherEncryptionConfigured()) {
      return NextResponse.json(
        { error: "Voucher reveal is not configured on the server." },
        { status: 500 }
      );
    }

    const { id } = await params;
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order, error: orderError } = await supabaseAdminClient
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let resolvedOrder = order;

    if (
      (order.status === "pending" || order.status === "paid") &&
      order.tx_hash
    ) {
      try {
        const verification = await verifyOrderPayment({
          orderId: order.id,
          userId: user.id,
          order,
        });
        resolvedOrder = verification.order;
      } catch {
        resolvedOrder = order;
      }
    }

    if (resolvedOrder.status !== "fulfilled" && resolvedOrder.status !== "revealed") {
      return NextResponse.json(
        { error: "Voucher reveal is only available for fulfilled orders." },
        { status: 409 }
      );
    }

    if (!resolvedOrder.voucher_inventory_id) {
      return NextResponse.json(
        { error: "No voucher inventory is assigned to this order yet." },
        { status: 409 }
      );
    }

    const { data: voucherInventory, error: inventoryError } =
      await supabaseAdminClient
        .from("voucher_inventory")
        .select("*")
        .eq("id", resolvedOrder.voucher_inventory_id)
        .eq("assigned_order_id", resolvedOrder.id)
        .single();

    if (inventoryError || !voucherInventory) {
      return NextResponse.json(
        { error: "Assigned voucher inventory could not be loaded." },
        { status: 404 }
      );
    }

    const voucherCode = decryptVoucherCode(voucherInventory.code_ciphertext);
    const forwardedFor = req.headers.get("x-forwarded-for");
    const ipHash = hashIp(forwardedFor?.split(",")[0]?.trim() ?? null);

    const { error: revealEventError } = await supabaseAdminClient
        .from("voucher_reveal_events")
        .insert({
        order_id: resolvedOrder.id,
        user_id: user.id,
        ip_hash: ipHash,
      });

    if (revealEventError) {
      return NextResponse.json(
        { error: "Failed to record reveal event", details: revealEventError.message },
        { status: 500 }
      );
    }

    if (resolvedOrder.status !== "revealed") {
      const revealedAt = new Date().toISOString();

      const [orderUpdate, inventoryUpdate] = await Promise.all([
        supabaseAdminClient
          .from("orders")
          .update({ status: "revealed", updated_at: revealedAt })
          .eq("id", resolvedOrder.id),
        supabaseAdminClient
          .from("voucher_inventory")
          .update({ status: "revealed", updated_at: revealedAt })
          .eq("id", voucherInventory.id),
      ]);

      if (orderUpdate.error || inventoryUpdate.error) {
        return NextResponse.json(
          {
            error: "Failed to finalize reveal status",
            details:
              orderUpdate.error?.message ?? inventoryUpdate.error?.message,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        data: {
          order_id: resolvedOrder.id,
          voucher_code: voucherCode,
          status: "revealed",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
