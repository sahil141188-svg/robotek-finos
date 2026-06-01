/**
 * Seasonality + target analysis for the AI Sales Coordinator.
 * Measures monthly demand from real order data, derives a seasonal index,
 * and proposes data-grounded YEARLY + MONTHLY targets per top item.
 * Read-only. Run: node scripts/sales-seasonality.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function all(table, cols, mod = (q) => q) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await mod(db.from(table).select(cols).range(from, from + 999));
    if (error) throw new Error(error.message);
    out.push(...data);
    if (data.length < 1000) break; from += 1000;
  }
  return out;
}

const MONTH = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// exclude the 1 synthetic import-dated order
const orders = (await all("sales_orders", "id,ordered_at")).filter((o) => !o.ordered_at.startsWith("2026-06-01"));
const omonth = new Map(orders.map((o) => [o.id, Number(o.ordered_at.slice(5, 7))]));
const items = await all("sales_order_items", "order_id,product_id,qty");
const prods = new Map((await all("sales_products", "id,name")).map((p) => [p.id, p.name]));

// monthly totals (qty) across all items
const monthQty = Array(13).fill(0);
const perItemMonth = new Map(); // productId -> [13]
for (const it of items) {
  const m = omonth.get(it.order_id); if (!m) continue;
  monthQty[m] += it.qty;
  if (!perItemMonth.has(it.product_id)) perItemMonth.set(it.product_id, Array(13).fill(0));
  perItemMonth.get(it.product_id)[m] += it.qty;
}

// drop partial boundary months: any month with qty < 25% of the median month
const nonzero = [...Array(13).keys()].filter((m) => m >= 1 && monthQty[m] > 0).map((m) => monthQty[m]).sort((a, b) => a - b);
const median = nonzero[Math.floor(nonzero.length / 2)];
const PARTIAL = [...Array(13).keys()].filter((m) => m >= 1 && monthQty[m] > 0 && monthQty[m] < 0.25 * median);
const observed = [...Array(13).keys()].filter((m) => m >= 1 && monthQty[m] > 0 && !PARTIAL.includes(m));
const avgMonth = observed.reduce((a, m) => a + monthQty[m], 0) / observed.length;
console.log("(excluded partial-data months:", PARTIAL.map((m) => MONTH[m]).join(", ") || "none", ")\n");

console.log("──────── SEASONAL CURVE (total qty by calendar month) ────────");
console.log("  month   qty          index   bar");
for (let m = 1; m <= 12; m++) {
  if (monthQty[m] === 0) { console.log(`  ${MONTH[m]}     —  (no data this month)`); continue; }
  const idx = monthQty[m] / avgMonth;
  const bar = "█".repeat(Math.round(idx * 18));
  console.log(`  ${MONTH[m]}   ${String(Math.round(monthQty[m])).padStart(8)}     ${idx.toFixed(2)}x  ${bar}`);
}
console.log(`  (index = month ÷ average month; observed months: ${observed.map((m) => MONTH[m]).join(", ")})`);

// seasonal weights normalized over observed months (so they sum to #observed)
const seasonalIdx = {};
for (let m = 1; m <= 12; m++) seasonalIdx[m] = monthQty[m] > 0 ? monthQty[m] / avgMonth : null;

console.log("\n──────── PROPOSED TARGETS — top 12 items (data-derived baseline) ────────");
console.log("  these = what you ALREADY sell on average; adjust up/down to your true breakeven minimum.\n");
console.log("  item                       avg/mo   →  YEARLY    peak-mo(e.g Oct)   lean-mo(e.g Feb)");
const ranked = [...perItemMonth.entries()]
  .map(([pid, arr]) => {
    const obs = observed.map((m) => arr[m]);
    const avg = obs.reduce((a, b) => a + b, 0) / observed.length;
    return { name: prods.get(pid), avg, arr };
  })
  .sort((a, b) => b.avg - a.avg)
  .slice(0, 12);

const peakM = observed.reduce((a, m) => (monthQty[m] > monthQty[a] ? m : a), observed[0]);
const leanM = observed.reduce((a, m) => (monthQty[m] < monthQty[a] ? m : a), observed[0]);
for (const r of ranked) {
  const yearly = Math.round(r.avg * 12);
  const peak = Math.round(r.avg * seasonalIdx[peakM]);
  const lean = Math.round(r.avg * seasonalIdx[leanM]);
  console.log(`  ${r.name.slice(0, 24).padEnd(26)} ${String(Math.round(r.avg)).padStart(6)}   →  ${String(yearly).padStart(7)}    ${MONTH[peakM]}: ${String(peak).padStart(6)}      ${MONTH[leanM]}: ${String(lean).padStart(6)}`);
}
console.log(`\n  peak month in data = ${MONTH[peakM]} (${seasonalIdx[peakM].toFixed(2)}x), lean = ${MONTH[leanM]} (${seasonalIdx[leanM].toFixed(2)}x)`);
console.log("\n✅  Seasonality analysis done.");
