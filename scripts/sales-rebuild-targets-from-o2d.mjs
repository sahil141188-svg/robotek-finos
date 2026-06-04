/**
 * Rebuild ALL sales targets from the authoritative O2D export, using ONLY the
 * trailing 12 complete months (Jun 2025 – May 2026). Zero-stitching, zero
 * partial months, zero future-dated error rows.
 *
 *   monthly_target_qty (item)        = total qty in window / 12
 *   unit_value (rough Rs/unit)       = total Est Amount / total qty
 *   is_breakeven                     = active items in the top 80% of value-weight
 *   customer_item_targets            = per (customer,item): qty/12, months_active, focus
 *
 * Maps O2D names → existing sales_products / sales_customers by normalized name.
 *
 * Preview:  node scripts/sales-rebuild-targets-from-o2d.mjs
 * Apply:    node scripts/sales-rebuild-targets-from-o2d.mjs --apply
 */
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const O2D = process.env.O2D_CSV || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/CA17EB4D-7604-468A-AEAC-7ECA4D749719/O2D_Export_2026-06-02 (1).csv";

const norm = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
const numv = (v) => Number(String(v ?? "").replace(/[^0-9.\-]/g, "")) || 0;
const ymOf = (v) => {
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 7);
  const m = String(v).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) { let [, , mo, y] = m; y = y.length === 2 ? "20" + y : y; return `${y}-${String(mo).padStart(2, "0")}`; }
  return null;
};
// trailing 12 complete months ending May 2026
const WIN = new Set();
for (let i = 0; i < 12; i++) WIN.add(new Date(Date.UTC(2025, 5 + i, 1)).toISOString().slice(0, 7));

const wb = xlsx.readFile(O2D);
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null, raw: true });

const items = new Map();         // normItem -> {qty, amt, name, months:Set}
const pairs = new Map();         // `${normCust}|${normItem}` -> {qty, months:Set, lastYm, lastQty, custName, itemName}
let used = 0;
for (const r of rows) {
  const ym = ymOf(r["Created At"]);
  if (!WIN.has(ym)) continue;
  used++;
  const inm = norm(r["Item Name"]); if (!inm) continue;
  const q = numv(r["Item Qty"]), a = numv(r["Est Amount"]);
  const it = items.get(inm) || { qty: 0, amt: 0, name: String(r["Item Name"] ?? "").trim(), months: new Set() };
  it.qty += q; it.amt += a; it.months.add(ym); items.set(inm, it);
  const cnm = norm(r["Party Name"]); if (!cnm) continue;
  const k = `${cnm}|${inm}`;
  const pr = pairs.get(k) || { qty: 0, months: new Set(), lastYm: "0", lastQty: 0, custName: String(r["Party Name"] ?? "").trim(), itemName: it.name };
  pr.qty += q; pr.months.add(ym); if (ym > pr.lastYm) { pr.lastYm = ym; pr.lastQty = q; }
  pairs.set(k, pr);
}
console.log(`O2D rows in window (Jun2025–May2026): ${used} | items: ${items.size} | customer-item pairs: ${pairs.size}`);

const prods = (await db.from("sales_products").select("id,name,monthly_target_qty,is_active,category")).data || [];
const custs = (await db.from("sales_customers").select("id,name")).data || [];
const prodByNorm = new Map(prods.map((p) => [norm(p.name), p]));
const custByNorm = new Map(custs.map((c) => [norm(c.name), c]));

// item coverage + value
let pItemMatch = 0; const updProducts = [];
const valW = [];
for (const [k, e] of items) {
  const p = prodByNorm.get(k); if (!p) continue; pItemMatch++;
  const uv = e.qty > 0 ? Math.round((e.amt / e.qty) * 10) / 10 : null;
  const monthly = Math.round((e.qty / 12) * 1.10); // 12-mo average + 10% growth target
  updProducts.push({ id: p.id, name: p.name, is_active: p.is_active, unit_value: uv, monthly_target_qty: monthly, total_qty_sold: Math.round(e.qty), _w: e.qty * (uv ?? 0) });
}
// breakeven = active items, top 80% of value-weight
const active = updProducts.filter((p) => p.is_active).sort((a, b) => b._w - a._w);
const grand = active.reduce((s, p) => s + p._w, 0); let cum = 0; const core = new Set();
for (const p of active) { cum += p._w; if (cum <= 0.8 * grand) core.add(p.id); }

// customer-item coverage. focus = items covering the top 80% of THAT customer's
// 12-month volume AND bought in 2+ months (a genuine regular line to push).
let pairMatch = 0; const byCust = new Map();
for (const [, pr] of pairs) {
  const c = custByNorm.get(norm(pr.custName)); const p = prodByNorm.get(norm(pr.itemName));
  if (!c || !p) continue; pairMatch++;
  if (!byCust.has(c.id)) byCust.set(c.id, []);
  byCust.get(c.id).push({ pr, productId: p.id });
}
const updPairs = [];
for (const [cid, list] of byCust) {
  list.sort((a, b) => b.pr.qty - a.pr.qty);
  const grandC = list.reduce((s, x) => s + x.pr.qty, 0); let cc = 0;
  for (const { pr, productId } of list) {
    cc += pr.qty;
    const isFocus = cc <= 0.8 * grandC && pr.months.size >= 2;
    // customer monthly target = avg over the months they ACTUALLY ordered (+10%),
    // not /12 — bulk buyers order a few big times/year, so /12 understates badly.
    const avgActive = Math.round(pr.qty / Math.max(1, pr.months.size));
    updPairs.push({ customer_id: cid, product_id: productId, monthly_target_qty: Math.round(avgActive * 1.10), avg_monthly_qty: avgActive, months_active: pr.months.size, total_qty: Math.round(pr.qty), last_qty: pr.lastQty, last_ordered_at: `${pr.lastYm}-01`, is_focus: isFocus });
  }
}

console.log(`items matched to catalog: ${pItemMatch}/${items.size} | customer-item pairs matched: ${pairMatch}/${pairs.size}`);
console.log(`active breakeven core: ${core.size} | customer-item targets: ${updPairs.length} (focus: ${updPairs.filter((x) => x.is_focus).length})`);

console.log("\nTOP 15 items — OLD (wrong) /mo  vs  NEW (12-mo avg) /mo:");
console.log("  item                     12mo qty   OLD/mo    NEW/mo");
for (const r of [...updProducts].sort((a, b) => b.total_qty_sold - a.total_qty_sold).slice(0, 15))
  console.log(`  ${r.name.slice(0, 22).padEnd(24)} ${String(r.total_qty_sold).padStart(8)}  ${String(prods.find((p) => p.id === r.id).monthly_target_qty || 0).padStart(8)}  ${String(r.monthly_target_qty).padStart(8)}`);

if (!APPLY) { console.log("\n(preview — re-run with --apply to write corrected targets)"); process.exit(0); }

console.log("\nApplying…");
// 1) reset all product targets, then set from window
for (const p of prods) await db.from("sales_products").update({ monthly_target_qty: null, is_breakeven: false }).eq("id", p.id);
for (const p of updProducts) await db.from("sales_products").update({ unit_value: p.unit_value, total_qty_sold: p.total_qty_sold, monthly_target_qty: p.is_active ? p.monthly_target_qty : null, is_breakeven: core.has(p.id) }).eq("id", p.id);
// 2) replace customer-item targets
await db.from("sales_customer_item_targets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
for (let i = 0; i < updPairs.length; i += 500) await db.from("sales_customer_item_targets").upsert(updPairs.slice(i, i + 500), { onConflict: "customer_id,product_id" });
console.log(`✅ Rebuilt: ${updProducts.length} item targets (${core.size} breakeven) + ${updPairs.length} customer-item targets from the clean 12-month window.`);
