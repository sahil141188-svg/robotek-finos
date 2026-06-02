/**
 * Per-customer, per-item targets for the AI Sales Coordinator.
 *
 * For every (customer, item) pair: baseline = avg qty over the clean months
 * the customer was active with that item; monthly_target_qty = baseline * 1.10.
 * is_focus = the items making up ~80% of THAT customer's volume (push these).
 *
 * Preview (no DB write, table not required):
 *     node scripts/sales-customer-item-targets.mjs
 * Apply (writes sales_customer_item_targets):
 *     node scripts/sales-customer-item-targets.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const UPLIFT = 1.10;
const FOCUS_COVERAGE = 0.80;

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

const orders = (await all("sales_orders", "id,customer_id,ordered_at")).filter((o) => !o.ordered_at.startsWith("2026-06-01"));
const oInfo = new Map(orders.map((o) => [o.id, { c: o.customer_id, m: Number(o.ordered_at.slice(5, 7)), d: o.ordered_at }]));
const items = await all("sales_order_items", "order_id,product_id,qty");
const custName = new Map((await all("sales_customers", "id,name")).map((c) => [c.id, c.name]));
const prodName = new Map((await all("sales_products", "id,name")).map((p) => [p.id, p.name]));

// clean months: global month totals, drop partial boundaries (<25% of median)
const monthTotal = Array(13).fill(0);
for (const it of items) { const o = oInfo.get(it.order_id); if (o) monthTotal[o.m] += it.qty; }
const nz = monthTotal.filter((q, m) => m >= 1 && q > 0).sort((a, b) => a - b);
const med = nz[Math.floor(nz.length / 2)];
const CLEAN = new Set([...Array(13).keys()].filter((m) => m >= 1 && monthTotal[m] > 0.25 * med));

// aggregate per (customer, item)
const pairs = new Map(); // `${c}|${p}` -> {c,p,total,months:Set,lastQty,lastAt}
for (const it of items) {
  const o = oInfo.get(it.order_id); if (!o) continue;
  const k = `${o.c}|${it.product_id}`;
  let e = pairs.get(k);
  if (!e) { e = { c: o.c, p: it.product_id, total: 0, months: new Set(), lastQty: 0, lastAt: "0" }; pairs.set(k, e); }
  e.total += it.qty;
  if (CLEAN.has(o.m)) e.months.add(o.m);
  if (o.d > e.lastAt) { e.lastAt = o.d; e.lastQty = it.qty; }
}

// group by customer to compute focus (80% coverage of that customer's volume)
const byCust = new Map();
for (const e of pairs.values()) {
  if (!byCust.has(e.c)) byCust.set(e.c, []);
  byCust.get(e.c).push(e);
}

const records = [];
for (const [cid, list] of byCust) {
  list.sort((a, b) => b.total - a.total);
  const grand = list.reduce((a, e) => a + e.total, 0);
  let cum = 0;
  for (const e of list) {
    const active = e.months.size || 1;
    const baseline = (CLEAN.size ? e.total * (e.months.size ? 1 : 0) : 0); // guard
    const avgMonthly = e.total / active; // avg over months they actually bought it
    cum += e.total;
    records.push({
      customer_id: cid,
      product_id: e.p,
      monthly_target_qty: Math.round(avgMonthly * UPLIFT),
      avg_monthly_qty: Math.round(avgMonthly),
      months_active: e.months.size,
      total_qty: e.total,
      last_qty: e.lastQty,
      last_ordered_at: e.lastAt,
      // focus = part of this customer's 80% core AND a genuine regular (bought in >=3 months),
      // so one-off bulk buys don't masquerade as a monthly push target
      is_focus: cum <= FOCUS_COVERAGE * grand && e.months.size >= 3,
      _cn: custName.get(cid),
      _pn: prodName.get(e.p),
    });
  }
}

const focus = records.filter((r) => r.is_focus);
console.log(`Pairs: ${records.length} | Focus pairs: ${focus.length} | Customers: ${byCust.size}`);

// preview: top 3 customers by total volume, show their focus items
const custVol = [...byCust.entries()].map(([c, l]) => [c, l.reduce((a, e) => a + e.total, 0)]).sort((a, b) => b[1] - a[1]);
for (const [cid] of custVol.slice(0, 3)) {
  console.log(`\n── ${custName.get(cid)} — focus items (monthly target = history +10%) ──`);
  console.log("   item                       mo target   months   last qty");
  for (const r of records.filter((r) => r.customer_id === cid && r.is_focus).slice(0, 8)) {
    console.log(`   ${(r._pn || "").slice(0, 24).padEnd(26)} ${String(r.monthly_target_qty).padStart(8)}   ${String(r.months_active).padStart(6)}   ${String(Math.round(r.last_qty)).padStart(7)}`);
  }
}

if (!APPLY) { console.log("\n(preview only — apply migration 010, then re-run with --apply)"); process.exit(0); }

console.log("\nWriting customer-item targets…");
const clean = records.map(({ _cn, _pn, ...r }) => r);
let n = 0;
for (let i = 0; i < clean.length; i += 500) {
  const { error } = await db.from("sales_customer_item_targets").upsert(clean.slice(i, i + 500), { onConflict: "customer_id,product_id" });
  if (error) throw new Error(error.message);
  n += clean.slice(i, i + 500).length;
}
console.log(`✅  Wrote ${n} customer-item targets (${focus.length} focus).`);
