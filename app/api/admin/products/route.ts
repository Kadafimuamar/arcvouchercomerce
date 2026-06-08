import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdminClient
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load products", details: error.message },
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

  const body = await req.json().catch(() => ({}));
  const { name, brand, description, price_usdc, image_url, active = true } =
    body ?? {};

  if (
    typeof name !== "string" ||
    typeof brand !== "string" ||
    typeof price_usdc !== "number"
  ) {
    return NextResponse.json(
      { error: "name, brand, and numeric price_usdc are required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdminClient
    .from("products")
    .insert({
      name,
      brand,
      description: typeof description === "string" ? description : null,
      price_usdc,
      image_url: typeof image_url === "string" ? image_url : null,
      active: Boolean(active),
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create product", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 201 });
}
