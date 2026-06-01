/**
 * Quick verification + preview of the AI Sales Coordinator data.
 * Proves the backfill worked and demonstrates Churn Radar + top movers
 * against the REAL data. Read-only.
 *
 * Run: node scripts/sales-verify.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "../.env.local") });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const count = async (t) => (await db.from(t).select("*", { count: "exact", head: true })).count;

console.log("──────── TABLE COUNTS ────────");
for (const t of ["sales_customers", "sales_products", "sales_orders", "sales_order_items"]) {
  console.log(`  ${t.padEnd(20)} ${await count(t)}`);
}

// pull all orders (id, customer, date) — small enough to compute in JS
async function allRows(table, cols) {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return out;
}

const orders = await allRows("sales_orders", "customer_id,ordered_at");
const custs = await allRows("sales_customers", "id,name,segment,total_orders");
const nameOf = new Map(custs.map((c) => [c.id, c.name]));

// reference "today" = latest order in the dataset (data is historical)
const maxTs = orders.reduce((m, o) => (o.ordered_at > m ? o.ordered_at : m), "0");
const today = new Date(maxTs);
console.log(`\nReference date (latest order in data): ${today.toISOString().slice(0, 10)}`);

// group order dates per customer
const byCust = new Map();
for (const o of orders) {
  if (!byCust.has(o.customer_id)) byCust.set(o.customer_id, []);
  byCust.get(o.customer_id).push(new Date(o.ordered_at));
}

const DAY = 86400000;
const radar = [];
for (const [cid, dates] of byCust) {
  if (dates.length < 3) continue; // need signal
  dates.sort((a, b) => a - b);
  const gaps = [];
  for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / DAY);
  const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const last = dates[dates.length - 1];
  const sinceLast = (today - last) / DAY;
  radar.push({ name: nameOf.get(cid), avgGap, sinceLast, overdueRatio: sinceLast / avgGap, orders: dates.length });
}

radar.sort((a, b) => b.overdueRatio - a.overdueRatio);
console.log("\n──────── CHURN RADAR (top overdue, relative to latest data date) ────────");
console.log("  customer                       orders  avg gap   days since   overdue x");
for (const r of radar.filter((r) => r.overdueRatio >= 1.5).slice(0, 12)) {
  console.log(
    `  ${r.name.slice(0, 28).padEnd(30)} ${String(r.orders).padStart(5)}  ${r.avgGap.toFixed(1).padStart(6)}d  ${r.sinceLast.toFixed(0).padStart(8)}d  ${r.overdueRatio.toFixed(1).padStart(6)}x`
  );
}

// top movers by lifetime qty
const prods = await allRows("sales_products", "name,total_qty_sold");
prods.sort((a, b) => b.total_qty_sold - a.total_qty_sold);
console.log("\n──────── TOP 10 MOVERS (breakeven-target candidates) ────────");
for (const p of prods.slice(0, 10)) console.log(`  ${String(Math.round(p.total_qty_sold)).padStart(8)}  ${p.name}`);

console.log("\n✅  Verification done — data is queryable and the AI SC logic runs.");
