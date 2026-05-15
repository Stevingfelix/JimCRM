#!/usr/bin/env npx tsx
/**
 * Import CAP Hardware parts catalog from an ERPAG HTML export.
 *
 * Usage:
 *   npx tsx scripts/import-erpag.ts [path-to-erpag.html]
 *   npx tsx scripts/import-erpag.ts --dry-run          # parse only, no DB writes
 *
 * Defaults to ./erpag.html if no path given.
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * What it does:
 *   1. Parses the HTML table exported from ERPAG (Google-Sheets-style)
 *   2. Upserts parts (SKU → internal_pn, Description → description)
 *   3. Creates vendors from the "Default - Supplier" column
 *   4. Creates part_aliases from "SKU(Supplier)" where present
 *   5. Creates vendor_quotes from "Purchase price" where > 0
 *   6. Logs a summary of what was imported
 *
 * Safe to run multiple times — uses upsert / duplicate checks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const fileArg = args.find((a) => !a.startsWith("--"));

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
function loadEnv(filePath: string): void {
  try {
    const content = readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local might not exist in CI
  }
}

loadEnv(resolve(process.cwd(), ".env.local"));
loadEnv(resolve(process.cwd(), ".env"));

let supabase: SupabaseClient | null = null;

if (!DRY_RUN) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Use --dry-run to skip DB.",
    );
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// HTML table parser (handles the Google Sheets "waffle" export format)
// ---------------------------------------------------------------------------
type Row = string[];

function parseHtmlTable(html: string): Row[] {
  const rows: Row[] = [];
  let currentRow: string[] = [];
  let inCell = false;
  let cellText = "";
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const closeTagEnd = html.indexOf(">", i);
      if (closeTagEnd < 0) break;
      const tag = html.slice(i + 1, closeTagEnd).toLowerCase().trim();
      const tagName = tag.replace(/^\//, "").split(/[\s/]/)[0];

      if (tagName === "td" || tagName === "th") {
        if (tag.startsWith("/")) {
          currentRow.push(cellText.trim());
          cellText = "";
          inCell = false;
        } else {
          inCell = true;
          cellText = "";
        }
      } else if (tagName === "tr") {
        if (tag.startsWith("/")) {
          if (currentRow.length > 0) rows.push(currentRow);
          currentRow = [];
        }
      }
      i = closeTagEnd + 1;
    } else {
      if (inCell) {
        if (html[i] === "&") {
          const semiIdx = html.indexOf(";", i);
          if (semiIdx > 0 && semiIdx - i < 10) {
            const entity = html.slice(i, semiIdx + 1);
            cellText += decodeEntity(entity);
            i = semiIdx + 1;
            continue;
          }
        }
        cellText += html[i];
      }
      i++;
    }
  }

  return rows;
}

function decodeEntity(entity: string): string {
  const map: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return map[entity] ?? entity;
}

// ---------------------------------------------------------------------------
// ERPAG column mapping
// ---------------------------------------------------------------------------
// Row layout: [0]=row#, [1]=SKU, [2]=Description, [3]=EAN/UPC, [4]=UOM,
// [5]=Type, [6]=Tax category, [7]=Item category, [8]=Trademark,
// [9]=Storage location, [10]=Default-Price, [11]=Min stock qty,
// [12]=Master product SKU, [13]=Master product Description,
// [14]=Default-Supplier, [15]=SKU(Supplier), [16]=Purchase price, ...

const COL = {
  SKU: 1,
  DESCRIPTION: 2,
  UOM: 4,
  DEFAULT_PRICE: 10,
  DEFAULT_SUPPLIER: 14,
  SUPPLIER_SKU: 15,
  PURCHASE_PRICE: 16,
} as const;

const JUNK_SUPPLIERS = new Set([
  "default - supplier",
  "cc misc auto expense supplier",
  "cc misc software supplier",
  "cc office expense misc supplier",
  "cc subscriptions misc supplier",
  "cc warehouse misc expense supplier",
]);

interface ErpagRow {
  sku: string;
  description: string | null;
  uom: string;
  defaultPrice: number;
  defaultSupplier: string | null;
  supplierSku: string | null;
  purchasePrice: number;
}

function parseRow(cells: string[]): ErpagRow | null {
  const sku = (cells[COL.SKU] ?? "").trim();
  if (!sku) return null;

  const desc = (cells[COL.DESCRIPTION] ?? "").trim();
  const uom = (cells[COL.UOM] ?? "EA").trim() || "EA";
  const defaultPrice = parseFloat(cells[COL.DEFAULT_PRICE] ?? "0") || 0;
  const supplier = (cells[COL.DEFAULT_SUPPLIER] ?? "").trim();
  const supplierSku = (cells[COL.SUPPLIER_SKU] ?? "").trim();
  const purchasePrice = parseFloat(cells[COL.PURCHASE_PRICE] ?? "0") || 0;

  const realDesc = desc && desc !== sku && desc !== "0" ? desc : null;
  const realSupplier =
    supplier && !JUNK_SUPPLIERS.has(supplier.toLowerCase()) ? supplier : null;
  const realSupplierSku =
    supplierSku && supplierSku !== "0" && supplierSku !== sku
      ? supplierSku
      : null;

  return {
    sku,
    description: realDesc,
    uom,
    defaultPrice,
    defaultSupplier: realSupplier,
    supplierSku: realSupplierSku,
    purchasePrice,
  };
}

// ---------------------------------------------------------------------------
// Supabase batch helper
// ---------------------------------------------------------------------------
const BATCH_SIZE = 500;

async function batchUpsert(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase generic requires any
  rows: any[],
  onConflict: string,
): Promise<number> {
  if (!supabase) return rows.length; // dry-run
  let total = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: true, count: "exact" });
    if (error) {
      console.error(`  Error upserting ${table} batch ${i}:`, error.message);
    } else {
      total += count ?? batch.length;
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (DRY_RUN) console.log("*** DRY RUN — no database writes ***\n");

  const filePath = resolve(process.cwd(), fileArg ?? "erpag.html");
  console.log(`Reading ${filePath}...`);
  const html = readFileSync(filePath, "utf-8");

  console.log("Parsing HTML table...");
  const allRows = parseHtmlTable(html);
  console.log(`  Found ${allRows.length} rows (including 2 header rows)`);

  // Row 0 = spreadsheet column letters (A/B/C), row 1 = actual header names.
  const dataRows = allRows.slice(2);
  const parsed: ErpagRow[] = [];
  let skipped = 0;

  for (const cells of dataRows) {
    const row = parseRow(cells);
    if (row) {
      parsed.push(row);
    } else {
      skipped++;
    }
  }

  const withDesc = parsed.filter((r) => r.description).length;
  const withPrice = parsed.filter((r) => r.defaultPrice > 0).length;
  const withSupplier = parsed.filter((r) => r.defaultSupplier).length;
  const withSupplierSku = parsed.filter((r) => r.supplierSku).length;
  const withPurchasePrice = parsed.filter(
    (r) => r.purchasePrice > 0 && r.defaultSupplier,
  ).length;

  console.log(`  Parsed ${parsed.length} parts, skipped ${skipped} empty rows`);
  console.log(`  ├─ with description:    ${withDesc}`);
  console.log(`  ├─ with default price:  ${withPrice}`);
  console.log(`  ├─ with supplier:       ${withSupplier}`);
  console.log(`  ├─ with supplier SKU:   ${withSupplierSku}`);
  console.log(`  └─ with purchase price: ${withPurchasePrice}`);

  if (DRY_RUN) {
    // Show a sample
    console.log("\nSample rows:");
    for (const r of parsed.slice(0, 5)) {
      console.log(
        `  ${r.sku} | ${(r.description ?? "(no desc)").slice(0, 50)} | $${r.defaultPrice} | ${r.defaultSupplier ?? "-"} | cost $${r.purchasePrice}`,
      );
    }
    console.log("\n*** Dry run complete. Run without --dry-run to import. ***");
    return;
  }

  // ------------------------------------------------------------------
  // 1. Upsert parts
  // ------------------------------------------------------------------
  console.log("\n1. Upserting parts...");
  const partsPayload = parsed.map((r) => ({
    internal_pn: r.sku,
    description: r.description,
  }));
  const partsUpserted = await batchUpsert("parts", partsPayload, "internal_pn");
  console.log(`   ${partsUpserted} parts upserted`);

  // Fetch all part IDs for FK references
  console.log("   Fetching part ID map...");
  const partIdMap = new Map<string, string>();
  let offset = 0;
  while (true) {
    const { data } = await supabase!
      .from("parts")
      .select("id, internal_pn")
      .range(offset, offset + 999);
    if (!data || data.length === 0) break;
    for (const p of data) partIdMap.set(p.internal_pn, p.id);
    offset += data.length;
    if (data.length < 1000) break;
  }
  console.log(`   ${partIdMap.size} parts in DB`);

  // ------------------------------------------------------------------
  // 2. Create vendors
  // ------------------------------------------------------------------
  console.log("\n2. Creating vendors...");
  const uniqueSuppliers = new Set<string>();
  for (const r of parsed) {
    if (r.defaultSupplier) uniqueSuppliers.add(r.defaultSupplier);
  }

  const { data: existingVendors } = await supabase!
    .from("vendors")
    .select("id, name");
  const vendorNameMap = new Map<string, string>();
  for (const v of existingVendors ?? []) {
    vendorNameMap.set(v.name.toLowerCase(), v.id);
  }

  const newVendors = Array.from(uniqueSuppliers)
    .filter((name) => !vendorNameMap.has(name.toLowerCase()))
    .map((name) => ({ name }));

  if (newVendors.length > 0) {
    const { data: inserted } = await supabase!
      .from("vendors")
      .insert(newVendors)
      .select("id, name");
    for (const v of inserted ?? []) {
      vendorNameMap.set(v.name.toLowerCase(), v.id);
    }
  }
  console.log(
    `   ${vendorNameMap.size} total vendors (${newVendors.length} newly created)`,
  );

  // ------------------------------------------------------------------
  // 3. Create part aliases from supplier SKUs
  // ------------------------------------------------------------------
  console.log("\n3. Creating part aliases from supplier SKUs...");
  const aliasPayload: Array<{
    part_id: string;
    alias_pn: string;
    source_type: string;
    source_name: string;
  }> = [];

  for (const r of parsed) {
    if (!r.supplierSku || !r.defaultSupplier) continue;
    const partId = partIdMap.get(r.sku);
    if (!partId) continue;
    aliasPayload.push({
      part_id: partId,
      alias_pn: r.supplierSku,
      source_type: "vendor",
      source_name: r.defaultSupplier,
    });
  }

  // Deduplicate
  const seenAliases = new Set<string>();
  const dedupedAliases = aliasPayload.filter((a) => {
    const k = `${a.part_id}:${a.alias_pn}`;
    if (seenAliases.has(k)) return false;
    seenAliases.add(k);
    return true;
  });

  // Skip aliases that already exist in DB
  const existingAliasKeys = new Set<string>();
  let aOffset = 0;
  while (true) {
    const { data } = await supabase!
      .from("part_aliases")
      .select("part_id, alias_pn")
      .range(aOffset, aOffset + 999);
    if (!data || data.length === 0) break;
    for (const a of data) existingAliasKeys.add(`${a.part_id}:${a.alias_pn}`);
    aOffset += data.length;
    if (data.length < 1000) break;
  }

  const newAliases = dedupedAliases.filter(
    (a) => !existingAliasKeys.has(`${a.part_id}:${a.alias_pn}`),
  );

  let aliasCreated = 0;
  for (let i = 0; i < newAliases.length; i += BATCH_SIZE) {
    const batch = newAliases.slice(i, i + BATCH_SIZE);
    const { error } = await supabase!.from("part_aliases").insert(batch);
    if (error) {
      console.error(`   Error inserting aliases batch ${i}:`, error.message);
    } else {
      aliasCreated += batch.length;
    }
  }
  console.log(
    `   ${aliasCreated} aliases created (from ${dedupedAliases.length} supplier SKU mappings)`,
  );

  // ------------------------------------------------------------------
  // 4. Create vendor quotes from purchase prices
  // ------------------------------------------------------------------
  console.log("\n4. Creating vendor quotes from purchase prices...");
  const vqPayload: Array<{
    vendor_id: string;
    part_id: string;
    qty: number;
    unit_price: number;
    source_note: string;
  }> = [];

  for (const r of parsed) {
    if (r.purchasePrice <= 0 || !r.defaultSupplier) continue;
    const partId = partIdMap.get(r.sku);
    const vendorId = vendorNameMap.get(r.defaultSupplier.toLowerCase());
    if (!partId || !vendorId) continue;
    vqPayload.push({
      vendor_id: vendorId,
      part_id: partId,
      qty: 1,
      unit_price: r.purchasePrice,
      source_note: "ERPAG import — historical purchase price",
    });
  }

  // Deduplicate by vendor_id + part_id
  const seenVqs = new Set<string>();
  const dedupedVqs = vqPayload.filter((v) => {
    const k = `${v.vendor_id}:${v.part_id}`;
    if (seenVqs.has(k)) return false;
    seenVqs.add(k);
    return true;
  });

  let vqCreated = 0;
  for (let i = 0; i < dedupedVqs.length; i += BATCH_SIZE) {
    const batch = dedupedVqs.slice(i, i + BATCH_SIZE);
    const { error } = await supabase!.from("vendor_quotes").insert(batch);
    if (error) {
      console.error(`   Error inserting vendor_quotes batch ${i}:`, error.message);
    } else {
      vqCreated += batch.length;
    }
  }
  console.log(`   ${vqCreated} vendor quotes created`);

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  console.log("\n========================================");
  console.log("Import complete");
  console.log("========================================");
  console.log(`  Parts upserted:        ${partsUpserted}`);
  console.log(`  Vendors created:       ${newVendors.length}`);
  console.log(`  Part aliases created:  ${aliasCreated}`);
  console.log(`  Vendor quotes created: ${vqCreated}`);
  console.log(`  Rows skipped:          ${skipped}`);
  console.log("========================================");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
