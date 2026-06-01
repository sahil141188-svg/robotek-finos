/**
 * Set AI SC targets from history + 10%.
 *
 * For each product: baseline = average qty over CLEAN observed months
 * (partial boundary months excluded). monthly_target_qty = baseline * 1.10.
 * "Core / breakeven" = the top sellers making up ~80% of total volume → those
 * get is_breakeven = true. The long tail = bonus (is_breakeven false, no target).
 * Yearly target = sum over 12 months of (monthly_target * seasonalIndex[m]).
 *
 * Preview:  node scripts/sales-set-targets.mjs
 * Apply:    node scripts/sales-set-targets.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "fs";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const UPLIFT = 1.10;
const CORE_COVERAGE = 0.80; // top items covering this share of volume = breakeven core

const idx = JSON.parse(readFileSync(new URL("../lib/sales/seasonal-index.json", import.meta.url)));
const SEASON = Object.fromEntries(Object.entries(idx).filter(([k]) => /^\d+$/.test(k)).map(([k, v]) => [Number(k), v]));
const yearlyFactor = Object.values(SEASON).reduce((a, b) => a + b, 0); // ~ sum of 12 monthly multipliers

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

const orders = (await all("sales_orders", "id,ordered_at")).filter((o) => !o.ordered_at.startsWith("2026-06-01"));
const omonth = new Map(orders.map((o) => [o.id, Number(o.ordered_at.slice(5, 7))]));
const items = await all("sales_order_items", "order_id,product_id,qty");
const prods = await all("sales_products", "id,name");
const nameOf = new Map(prods.map((p) => [p.id, p.name]));

// monthly qty per product + global month totals
const perItem = new Map(); // pid -> [13]
const monthTotal = Array(13).fill(0);
for (const it of items) {
  const m = omonth.get(it.order_id); if (!m) continue;
  if (!perItem.has(it.product_id)) perItem.set(it.product_id, Array(13).fill(0));
  perItem.get(it.product_id)[m] += it.qty;
  monthTotal[m] += it.qty;
}
// clean observed months = those above 25% of median (drops partial boundaries)
const nz = monthTotal.filter((q, m) => m >= 1 && q > 0).sort((a, b) => a - b);
const med = nz[Math.floor(nz.length / 2)];
const CLEAN = [...Array(13).keys()].filter((m) => m >= 1 && monthTotal[m] > 0.25 * med);

// build per-item baseline + total
const rows = [...perItem.entries()].map(([pid, arr]) => {
  const baseline = CLEAN.reduce((a, m) => a + arr[m], 0) / CLEAN.length;
  const total = arr.reduce((a, b) => a + b, 0);
  return { pid, name: nameOf.get(pid), baseline, total };
}).sort((a, b) => b.total - a.total);

// mark core (cumulative <= 80% of grand total)
const grand = rows.reduce((a, r) => a + r.total, 0);
let cum = 0;
for (const r of rows) { cum += r.total; r.core = cum <= CORE_COVERAGE * grand || r.baseline >= rows[0].baseline * 0.02; }
// ensure at least items with real volume are core; bonus = tiny tail
const core = rows.filter((r) => r.core && r.baseline > 0);

console.log(`Products: ${rows.length} | Core/breakeven: ${core.length} | Bonus tail: ${rows.length - core.length}`);
console.log(`Uplift: +${Math.round((UPLIFT - 1) * 100)}%  | yearly factor (sum of 12 seasonal multipliers): ${yearlyFactor.toFixed(2)}\n`);
console.log("Top 15 core targets (history +10%):");
console.log("  item                       mo target   yearly target");
for (const r of core.slice(0, 15)) {
  const mo = Math.round(r.baseline * UPLIFT);
  const yr = Math.round(r.baseline * UPLIFT * yearlyFactor);
  console.log(`  ${r.name.slice(0, 24).padEnd(26)} ${String(mo).padStart(8)}   ${String(yr).padStart(11)}`);
}
const totMo = core.reduce((a, r) => a + r.baseline * UPLIFT, 0);
console.log(`\n  COMBINED core monthly target : ${Math.round(totMo).toLocaleString("en-IN")} units/mo`);
console.log(`  COMBINED core yearly target  : ${Math.round(totMo * yearlyFactor).toLocaleString("en-IN")} units/yr`);

if (!APPLY) { console.log("\n(preview only — re-run with --apply to write targets)"); process.exit(0); }

console.log("\nWriting targets…");
const updates = rows.map((r) => ({
  id: r.pid,
  name: r.name,
  is_breakeven: !!(r.core && r.baseline > 0),
  monthly_target_qty: r.core && r.baseline > 0 ? Math.round(r.baseline * UPLIFT) : null,
  updated_at: new Date().toISOString(),
}));
for (let i = 0; i < updates.length; i += 500) {
  const { error } = await db.from("sales_products").upsert(updates.slice(i, i + 500), { onConflict: "name" });
  if (error) throw new Error(error.message);
}
console.log(`✅  Targets written: ${core.length} breakeven items with monthly targets, rest marked bonus.`);
