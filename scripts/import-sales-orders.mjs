/**
 * Robotek AI Sales Coordinator — order backfill / sync importer.
 *
 * Reads order history from one or more Google Sheets (via the public gviz
 * JSON endpoint) and loads it into the `sales_*` tables created in
 * migration 009. Safe to re-run: every item line gets a deterministic
 * `line_hash`, so re-running only inserts genuinely new lines.
 *
 * The two sheets have the SAME shape but a different "grouping" column,
 * so each source declares its own column mapping (0-based column index).
 *
 * Usage:
 *   node scripts/import-sales-orders.mjs --dry            # parse only, no DB writes
 *   node scripts/import-sales-orders.mjs                  # import all sources
 *   node scripts/import-sales-orders.mjs --only=backup2026
 *
 * Run from project root. Reads keys from .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "../.env.local") });

// ---------------------------------------------------------------------------
// SOURCES — add the live Vercel-app tab here once its sheetId/gid is confirmed.
// col indexes are 0-based: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8 ...
// ---------------------------------------------------------------------------
const SOURCES = [
  {
    label: "backup2026",                       // Jan–Apr 2026 ("CRM Sheet Backup")
    sheetId: "1vWpNQn2jqPTlNzeqZQfFJk1g3PrWHFSs_kgsXLIss1c",
    gid: "343204249",
    map: { ts: 0, group: 1, firm: 2, item: 3, qty: 4, remarks: 5, stock: 6 },
  },
  {
    label: "live2024",                         // Jul–Dec 2024 (group key = Unique Number, col I)
    sheetId: "1ArY_6H-KTYfjIxr5xa5TWKiizuavfqWT6HaAM_8JFdQ",
    gid: "0",
    map: { ts: 0, group: 8, firm: 2, item: 3, qty: 4, remarks: 5, stock: null },
  },
];

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const ONLY = (argv.find((a) => a.startsWith("--only=")) || "").split("=")[1];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch + parse a sheet's gviz JSON into an array of row-cell arrays. */
async function fetchSheet(src) {
  const url = `https://docs.google.com/spreadsheets/d/${src.sheetId}/gviz/tq?tqx=out:json&gid=${src.gid}`;
  const raw = await fetch(url).then((r) => r.text());
  const json = JSON.parse(raw.replace(/^[^{]*/, "").replace(/\);?\s*$/, ""));
  return json.table.rows || [];
}

/** Value of a cell by column index (gviz uses {v: value, f: formatted}). */
function cellV(row, i) {
  if (i == null) return null;
  const c = row.c?.[i];
  return c ? (c.v ?? null) : null;
}

/** Convert gviz "Date(2026,0,1,9,42,45)" → ISO string (gviz month is 0-based). */
function parseGvizDate(v) {
  if (v == null) return null;
  const m = /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?/.exec(String(v));
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1).map((x) => (x == null ? 0 : Number(x)));
  const dt = new Date(Date.UTC(y, mo, d, h, mi, s));
  if (dt.getUTCFullYear() < 2000) return null; // skip blank/zero dates
  return dt.toISOString();
}

const clean = (s) => (s == null ? null : String(s).trim().replace(/\s+/g, " "));
const sha1 = (s) => createHash("sha1").update(s).digest("hex");

// ---------------------------------------------------------------------------
// Parse every source into in-memory structures
// ---------------------------------------------------------------------------
const customers = new Map(); // name -> {firstTs, lastTs, orderKeys:Set}
const products = new Map();  // name -> {qty}
const orders = new Map();    // "source|orderNo" -> {source, orderNo, firm, ts}
const items = [];            // {source, orderKey, firm, product, qty, stock, remarks, rawItem, ts, line_hash}

let scanned = 0,
  skipped = 0;

for (const src of SOURCES) {
  if (ONLY && src.label !== ONLY) continue;
  process.stdout.write(`📥  Fetching ${src.label}…  `);
  const rows = await fetchSheet(src);
  console.log(`${rows.length} rows`);

  const perOrderIdx = new Map(); // disambiguate duplicate identical lines within an order

  for (const row of rows) {
    const firm = clean(cellV(row, src.map.firm));
    const rawItem = cellV(row, src.map.item);
    const item = clean(rawItem);
    const group = clean(cellV(row, src.map.group));
    const qtyRaw = cellV(row, src.map.qty);
    if (!firm || !item || group == null) {
      skipped++;
      continue;
    }
    scanned++;
    const qty = Number(qtyRaw) || 0;
    const ts = parseGvizDate(cellV(row, src.map.ts));
    const stock = src.map.stock == null ? null : Number(cellV(row, src.map.stock)) || null;
    const remarks = clean(cellV(row, src.map.remarks));
    const orderKey = `${src.label}|${group}`;

    // customer aggregates
    if (!customers.has(firm)) customers.set(firm, { firstTs: ts, lastTs: ts, orderKeys: new Set() });
    const cu = customers.get(firm);
    if (ts && (!cu.firstTs || ts < cu.firstTs)) cu.firstTs = ts;
    if (ts && (!cu.lastTs || ts > cu.lastTs)) cu.lastTs = ts;
    cu.orderKeys.add(orderKey);

    // product aggregates
    products.set(item, { qty: (products.get(item)?.qty || 0) + qty });

    // order header (first timestamp wins)
    if (!orders.has(orderKey)) orders.set(orderKey, { source: src.label, orderNo: group, firm, ts });
    else if (ts && (!orders.get(orderKey).ts || ts < orders.get(orderKey).ts)) orders.get(orderKey).ts = ts;

    // line item with idempotent hash
    const n = (perOrderIdx.get(orderKey) || 0) + 1;
    perOrderIdx.set(orderKey, n);
    const line_hash = sha1(`${src.label}|${group}|${item}|${qty}|${ts || ""}|${n}`);
    items.push({ source: src.label, orderKey, firm, product: item, qty, stock, remarks, rawItem: String(rawItem), ts, line_hash });
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const seg = (n) => (n >= 30 ? "high" : n >= 8 ? "mid" : "low");
console.log("\n──────── PARSE SUMMARY ────────");
console.log("Sources         :", ONLY || SOURCES.map((s) => s.label).join(", "));
console.log("Line items      :", items.length, `(scanned ${scanned}, skipped ${skipped})`);
console.log("Orders          :", orders.size);
console.log("Customers       :", customers.size);
console.log("Products        :", products.size);
const segCounts = { high: 0, mid: 0, low: 0 };
for (const [, c] of customers) segCounts[seg(c.orderKeys.size)]++;
console.log("Segments        :", JSON.stringify(segCounts));
console.log("───────────────────────────────\n");

if (DRY) {
  console.log("✅  Dry run — no database writes. Parsing looks good.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Write to Supabase (service role bypasses RLS)
// ---------------------------------------------------------------------------
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

async function upsertAll(table, rows, onConflict) {
  for (const part of chunk(rows, 500)) {
    const { error } = await db.from(table).upsert(part, { onConflict, ignoreDuplicates: false });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

// 1) customers (with aggregates) ------------------------------------------------
console.log("⬆️   Upserting customers…");
await upsertAll(
  "sales_customers",
  [...customers].map(([name, c]) => ({
    name,
    segment: seg(c.orderKeys.size),
    first_order_at: c.firstTs,
    last_order_at: c.lastTs,
    total_orders: c.orderKeys.size,
    updated_at: new Date().toISOString(),
  })),
  "name"
);

// 2) products (with lifetime qty) -----------------------------------------------
console.log("⬆️   Upserting products…");
await upsertAll(
  "sales_products",
  [...products].map(([name, p]) => ({ name, total_qty_sold: p.qty, updated_at: new Date().toISOString() })),
  "name"
);

// fetch id maps -----------------------------------------------------------------
async function idMap(table) {
  const map = new Map();
  let from = 0;
  for (;;) {
    const { data, error } = await db.from(table).select("id,name").range(from, from + 999);
    if (error) throw new Error(error.message);
    data.forEach((r) => map.set(r.name, r.id));
    if (data.length < 1000) break;
    from += 1000;
  }
  return map;
}
const custId = await idMap("sales_customers");
const prodId = await idMap("sales_products");

// 3) orders ---------------------------------------------------------------------
console.log("⬆️   Upserting orders…");
await upsertAll(
  "sales_orders",
  [...orders.values()].map((o) => ({
    order_no: o.orderNo,
    customer_id: custId.get(o.firm),
    ordered_at: o.ts || new Date().toISOString(),
    source: o.source,
  })),
  "source,order_no"
);

// fetch order id map keyed by source|order_no ----------------------------------
const orderId = new Map();
{
  let from = 0;
  for (;;) {
    const { data, error } = await db.from("sales_orders").select("id,source,order_no").range(from, from + 999);
    if (error) throw new Error(error.message);
    data.forEach((r) => orderId.set(`${r.source}|${r.order_no}`, r.id));
    if (data.length < 1000) break;
    from += 1000;
  }
}

// 4) order items ----------------------------------------------------------------
console.log("⬆️   Upserting order items…");
await upsertAll(
  "sales_order_items",
  items.map((it) => ({
    order_id: orderId.get(it.orderKey),
    product_id: prodId.get(it.product),
    qty: it.qty,
    stock_at_order: it.stock,
    remarks: it.remarks,
    raw_item_name: it.rawItem,
    line_hash: it.line_hash,
  })),
  "line_hash"
);

console.log("\n✅  Backfill complete.");
console.log(`   ${customers.size} customers · ${products.size} products · ${orders.size} orders · ${items.length} line items`);
