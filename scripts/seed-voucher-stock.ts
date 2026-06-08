import crypto from "crypto";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import {
  encryptVoucherCode,
  getVoucherEncryptionKeyBuffer,
  hashVoucherCode,
} from "../lib/vouchers/encryption";
import type { Database } from "../types/supabase";

type ProductSeedDefinition = {
  name: string;
  brand: string;
  priceUsdc: number;
  brandToken: string;
};

type ProductRow = Database["public"]["Tables"]["products"]["Row"];
type VoucherInventoryInsert =
  Database["public"]["Tables"]["voucher_inventory"]["Insert"];

const STOCK_PER_PRODUCT = 100;
const PRODUCT_DEFINITIONS: ProductSeedDefinition[] = [
  {
    name: "Amazon $10 Gift Card",
    brand: "Amazon",
    priceUsdc: 10,
    brandToken: "AMAZON",
  },
  {
    name: "Amazon $25 Gift Card",
    brand: "Amazon",
    priceUsdc: 25,
    brandToken: "AMAZON",
  },
  {
    name: "Google Play $10 Gift Card",
    brand: "Google Play",
    priceUsdc: 10,
    brandToken: "GOOGLEPLAY",
  },
  {
    name: "Netflix $15 Gift Card",
    brand: "Netflix",
    priceUsdc: 15,
    brandToken: "NETFLIX",
  },
  {
    name: "Steam $20 Gift Card",
    brand: "Steam",
    priceUsdc: 20,
    brandToken: "STEAM",
  },
];

function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local was not found.");
  }

  const fileContent = fs.readFileSync(envPath, "utf8");
  for (const rawLine of fileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function validateEnvironment() {
  if (!process.env.SUPABASE_SECRET_KEY) {
    throw new Error("SUPABASE_SECRET_KEY is required in .env.local.");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required in .env.local.");
  }

  getVoucherEncryptionKeyBuffer();
}

function createSupabaseAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}

function formatPriceToken(priceUsdc: number) {
  return priceUsdc.toFixed(0);
}

function createDeterministicRandomToken(
  definition: ProductSeedDefinition,
  index: number
) {
  return crypto
    .createHash("sha256")
    .update(`${definition.name}:${definition.priceUsdc}:${index}`, "utf8")
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
}

function createVoucherCode(definition: ProductSeedDefinition, index: number) {
  const priceToken = formatPriceToken(definition.priceUsdc);
  const indexToken = String(index).padStart(3, "0");
  const randomToken = createDeterministicRandomToken(definition, index);

  return `DEMO-${definition.brandToken}-${priceToken}-${indexToken}-${randomToken}`;
}

async function findProductByExactNameAndPrice(
  availableProducts: ProductRow[],
  definition: ProductSeedDefinition
) {
  const exactNameMatch = availableProducts.find(
    (product) => product.name === definition.name
  );

  if (exactNameMatch) {
    return exactNameMatch;
  }

  const fallbackMatch = availableProducts.find(
    (product) =>
      product.brand === definition.brand &&
      Number(product.price_usdc) === definition.priceUsdc
  );

  if (fallbackMatch) {
    return fallbackMatch;
  }

  const catalogDump = availableProducts
    .map(
      (product) =>
        `- ${product.name} | brand=${product.brand} | price_usdc=${Number(product.price_usdc).toFixed(6)} | id=${product.id}`
    )
    .join("\n");

  throw new Error(
    [
      `Product not found for ${definition.name} @ ${definition.priceUsdc.toFixed(6)} USDC.`,
      "Available products in Supabase:",
      catalogDump || "- none found",
    ].join("\n")
  );
}

async function seedProductInventory(
  supabaseAdmin: ReturnType<typeof createSupabaseAdminClient>,
  product: ProductRow,
  definition: ProductSeedDefinition
) {
  const candidateCodes = Array.from({ length: STOCK_PER_PRODUCT }, (_, index) =>
    createVoucherCode(definition, index + 1)
  );
  const candidateHashes = candidateCodes.map((code) => hashVoucherCode(code));

  const { data: existingRows, error: existingRowsError } = await supabaseAdmin
    .from("voucher_inventory")
    .select("id, code_hash")
    .in("code_hash", candidateHashes);

  if (existingRowsError) {
    throw existingRowsError;
  }

  const existingHashes = new Set(
    (existingRows ?? []).map((row) => row.code_hash)
  );

  const rowsToInsert: VoucherInventoryInsert[] = [];

  candidateCodes.forEach((code, index) => {
    const codeHash = candidateHashes[index];
    if (existingHashes.has(codeHash)) {
      return;
    }

    rowsToInsert.push({
      product_id: product.id,
      code_ciphertext: encryptVoucherCode(code),
      code_hash: codeHash,
      status: "available",
    });
  });

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from("voucher_inventory")
      .insert(rowsToInsert);

    if (insertError) {
      throw insertError;
    }
  }

  const { error: refreshError } = await supabaseAdmin.rpc(
    "refresh_product_stock_count",
    {
      target_product_id: product.id,
    }
  );

  if (refreshError) {
    throw refreshError;
  }

  const { data: refreshedProduct, error: refreshedProductError } =
    await supabaseAdmin
      .from("products")
      .select("stock_count")
      .eq("id", product.id)
      .single();

  if (refreshedProductError || !refreshedProduct) {
    throw (
      refreshedProductError ?? new Error("Failed to reload product stock count.")
    );
  }

  return {
    insertedCount: rowsToInsert.length,
    skippedDuplicateCount: candidateCodes.length - rowsToInsert.length,
    availableStockCount: refreshedProduct.stock_count,
  };
}

async function main() {
  loadDotEnvLocal();
  validateEnvironment();

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: availableProducts, error: productsError } = await supabaseAdmin
    .from("products")
    .select("*")
    .order("name", { ascending: true })
    .order("price_usdc", { ascending: true });

  if (productsError || !availableProducts) {
    throw productsError ?? new Error("Failed to load products from Supabase.");
  }

  for (const definition of PRODUCT_DEFINITIONS) {
    const product = await findProductByExactNameAndPrice(
      availableProducts,
      definition
    );
    const summary = await seedProductInventory(
      supabaseAdmin,
      product,
      definition
    );

    console.log(
      [
        `product=${definition.name}`,
        `product_id=${product.id}`,
        `target_stock=${STOCK_PER_PRODUCT}`,
        `inserted=${summary.insertedCount}`,
        `skipped=${summary.skippedDuplicateCount}`,
        `available=${summary.availableStockCount}`,
      ].join(" | ")
    );
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Voucher stock seed failed."
  );
  process.exit(1);
});
