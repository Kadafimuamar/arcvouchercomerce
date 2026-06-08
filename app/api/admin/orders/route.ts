import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";

export async function GET() {
  const admin = await requireAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabaseAdminClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load orders", details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ data }, { status: 200 });
}
