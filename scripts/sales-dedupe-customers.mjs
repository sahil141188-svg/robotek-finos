/**
 * Customer de-duplication for the AI Sales Coordinator.
 * The order sheets spell the same firm multiple ways (casing / spacing /
 * "/" vs " "). This merges exact NORMALIZED-name matches into one record,
 * reassigns their orders, and recomputes aggregates.
 *
 * Conservative: only merges when normalized names are IDENTICAL.
 *   normalize = uppercase, turn [ /,.\-] into spaces, collapse spaces, trim.
 *
 * Preview (default):  node scripts/sales-dedupe-customers.mjs
 * Apply:              node scripts/sales-dedupe-customers.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

const norm = (s) => s.toUpperCase().replace(/[/,.\-]+/g, " ").replace(/\s+/g, " ").trim();

async function all(table, cols) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break; from += 1000;
  }
  return out;
}

const custs = await all("sales_customers", "id,name,total_orders");
const groups = new Map(); // normKey -> [customers]
for (const c of custs) {
  const k = norm(c.name);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(c);
}

const dupGroups = [...groups.values()].filter((g) => g.length > 1);
console.log(`Found ${dupGroups.length} duplicate group(s) covering ${dupGroups.reduce((a, g) => a + g.length, 0)} records.\n`);
for (const g of dupGroups) {
  // canonical = most orders, tiebreak longest name
  g.sort((a, b) => b.total_orders - a.total_orders || b.name.length - a.name.length);
  const keep = g[0];
  console.log(`  KEEP  "${keep.name}" (${keep.total_orders} ord)`);
  for (const d of g.slice(1)) console.log(`   ↳ merge "${d.name}" (${d.total_orders} ord)`);
}

if (!APPLY) {
  console.log(`\n(preview only — re-run with --apply to merge)`);
  process.exit(0);
}

console.log("\nApplying merges…");
let merged = 0;
for (const g of dupGroups) {
  const keep = g[0];
  for (const d of g.slice(1)) {
    const { error } = await db.from("sales_orders").update({ customer_id: keep.id }).eq("customer_id", d.id);
    if (error) throw new Error(error.message);
    const { error: delErr } = await db.from("sales_customers").delete().eq("id", d.id);
    if (delErr) throw new Error(delErr.message);
    merged++;
  }
  // recompute aggregates for the kept customer
  const { data: ords } = await db.from("sales_orders").select("ordered_at").eq("customer_id", keep.id);
  const dates = ords.map((o) => o.ordered_at).sort();
  const total = dates.length;
  await db.from("sales_customers").update({
    first_order_at: dates[0] || null,
    last_order_at: dates[dates.length - 1] || null,
    total_orders: total,
    segment: total >= 30 ? "high" : total >= 8 ? "mid" : "low",
    updated_at: new Date().toISOString(),
  }).eq("id", keep.id);
}
console.log(`✅  Merged ${merged} duplicate record(s) into their canonical customer.`);
