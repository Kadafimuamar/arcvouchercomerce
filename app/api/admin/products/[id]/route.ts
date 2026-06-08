import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const updatePayload = {
    ...(typeof body.name === "string" ? { name: body.name } : {}),
    ...(typeof body.brand === "string" ? { brand: body.brand } : {}),
    ...(typeof body.description === "string" || body.description === null
      ? { description: body.description }
      : {}),
    ...(typeof body.price_usdc === "number"
      ? { price_usdc: body.price_usdc }
      : {}),
    ...(typeof body.image_url === "string" || body.image_url === null
      ? { image_url: body.image_url }
      : {}),
    ...(typeof body.active === "boolean" ? { active: body.active } : {}),
  };

  const { data, error } = await supabaseAdminClient
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to update product", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 200 });
}
