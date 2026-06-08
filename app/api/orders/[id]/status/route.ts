import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { serializeOrder } from "@/lib/orders/presenter";
import { verifyOrderPayment } from "@/lib/orders/verification";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: order, error } = await supabaseAdminClient
      .from("orders")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let resolvedOrder = order;
    const needsVerification =
      (order.status === "pending" && Boolean(order.tx_hash)) ||
      (order.status === "paid" && !order.voucher_inventory_id);

    if (needsVerification) {
      try {
        const result = await verifyOrderPayment({
          orderId: order.id,
          userId: user.id,
          order,
        });
        resolvedOrder = result.order;
      } catch {
        resolvedOrder = order;
      }
    }

    return NextResponse.json({ data: serializeOrder(resolvedOrder) }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
