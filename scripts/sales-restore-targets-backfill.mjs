/**
 * Restore item monthly targets from the CLEAN per-line backfill (sales_order_items,
 * proper piece-scale qty) — the O2D export was too messy (concatenated rows +
 * gift items) and shrank targets ~4x.
 *
 * target = (item qty over clean months / #clean months) * 1.10, for ACTIVE items
 * (so every category gets a target). Seasonality (seasonal-index.json, May-Oct
 * hot) is left as-is and applied on top by the dashboard.
 *
 * Apply: node scripts/sales-restore-targets-backfill.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const UPLIFT = 1.10;

async function all(table, cols) {
  const out = []; let from = 0;
  for (;;) { const { data, error } = await db.from(table).select(cols).range(from, from + 999); if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) break; from += 1000; }
  return out;
}

const orders = (await all("sales_orders", "id,ordered_at")).filter((o) => !o.ordered_at.startsWith("2026-06-01"));
const omonth = new Map(orders.map((o) => [o.id, Number(o.ordered_at.slice(5, 7))]));
const items = await all("sales_order_items", "order_id,product_id,qty");
const prods = await all("sales_products", "id,name,category,is_active");

// global month totals -> clean months (drop partial boundaries < 25% of median)
const monthTotal = Array(13).fill(0);
const perItem = new Map();
for (const it of items) {
  const m = omonth.get(it.order_id); if (!m) continue;
  monthTotal[m] += it.qty;
  if (!perItem.has(it.product_id)) perItem.set(it.product_id, Array(13).fill(0));
  perItem.get(it.product_id)[m] += it.qty;
}
const nz = monthTotal.filter((q, m) => m >= 1 && q > 0).sort((a, b) => a - b);
const med = nz[Math.floor(nz.length / 2)];
const CLEAN = [...Array(13).keys()].filter((m) => m >= 1 && monthTotal[m] > 0.25 * med);
console.log("clean months used:", CLEAN.length);

const activeSet = new Map(prods.map((p) => [p.id, p]));
let activeWithTarget = 0; const catTotal = new Map();
const updates = prods.map((p) => {
  const arr = perItem.get(p.id);
  const baseline = arr ? CLEAN.reduce((a, m) => a + arr[m], 0) / CLEAN.length : 0;
  const monthly = p.is_active ? Math.round(baseline * UPLIFT) : null;
  if (p.is_active && monthly) { activeWithTarget++; catTotal.set(p.category || "OTHER", (catTotal.get(p.category || "OTHER") || 0) + monthly); }
  return { id: p.id, monthly };
});
const combined = [...catTotal.values()].reduce((a, b) => a + b, 0);

console.log(`\nActive items with a target: ${activeWithTarget}`);
console.log(`Combined monthly target (baseline): ${combined.toLocaleString("en-IN")} units/mo`);
console.log("\nCategory monthly targets:");
for (const [c, n] of [...catTotal.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(22)} ${n.toLocaleString("en-IN")}`);

if (APPLY) {
  for (const u of updates) await db.from("sales_products").update({ monthly_target_qty: u.monthly, updated_at: new Date().toISOString() }).eq("id", u.id);
  console.log(`\n✅ Restored monthly targets for ${updates.length} products from clean backfill.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
