import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import {
  encryptVoucherCode,
  hashVoucherCode,
  isVoucherEncryptionConfigured,
} from "@/lib/vouchers/encryption";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdminClient
    .from("voucher_inventory")
    .select("id, product_id, status, assigned_order_id, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load voucher inventory", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isVoucherEncryptionConfigured()) {
    return NextResponse.json(
      { error: "VOUCHER_ENCRYPTION_KEY is not configured." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { productId, codes } = body ?? {};

  if (typeof productId !== "string" || !Array.isArray(codes) || codes.length === 0) {
    return NextResponse.json(
      { error: "productId and a non-empty codes array are required." },
      { status: 400 }
    );
  }

  const rows = codes
    .filter((code): code is string => typeof code === "string" && code.trim().length > 0)
    .map((code) => ({
      product_id: productId,
      code_ciphertext: encryptVoucherCode(code.trim()),
      code_hash: hashVoucherCode(code.trim()),
    }));

  const { data, error } = await supabaseAdminClient
    .from("voucher_inventory")
    .insert(rows)
    .select("id, product_id, status, assigned_order_id, created_at, updated_at");

  if (error) {
    return NextResponse.json(
      { error: "Failed to insert voucher inventory", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
