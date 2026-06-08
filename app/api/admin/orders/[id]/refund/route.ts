import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { data: order, error: orderError } = await supabaseAdminClient
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "revealed") {
    return NextResponse.json(
      { error: "Revealed orders cannot be refunded automatically." },
      { status: 409 }
    );
  }

  const timestamp = new Date().toISOString();
  const updates = [];

  updates.push(
    supabaseAdminClient
      .from("orders")
      .update({ status: "refunded", updated_at: timestamp })
      .eq("id", order.id)
  );

  if (order.voucher_inventory_id) {
    updates.push(
      supabaseAdminClient
        .from("voucher_inventory")
        .update({ status: "disabled", updated_at: timestamp })
        .eq("id", order.voucher_inventory_id)
    );
  }

  const results = await Promise.all(updates);
  const firstError = results.find((result) => "error" in result && result.error)?.error;

  if (firstError) {
    return NextResponse.json(
      { error: "Failed to refund order", details: firstError.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { data: { order_id: order.id, status: "refunded" } },
    { status: 200 }
  );
}
