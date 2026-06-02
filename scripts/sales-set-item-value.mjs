/**
 * Compute a ROUGH per-unit value for each item from the O2D "Est Amount" export
 * and re-pick the breakeven core by VALUE-WEIGHT (qty x rough Rs/unit) instead
 * of quantity alone — so high-value/low-qty items (TWS, HF, SC) rise into core.
 *
 * unit_value is reference-only (rough), never shown as real revenue.
 *
 * Apply: node scripts/sales-set-item-value.mjs --apply
 */
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const O2D = process.env.O2D_CSV || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/CA17EB4D-7604-468A-AEAC-7ECA4D749719/O2D_Export_2026-06-02 (1).csv";
const CORE_COVERAGE = 0.80;
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");
const numv = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };

// 1) per-item rough unit value from O2D
const wb = xlsx.readFile(O2D, { raw: false });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const o2d = new Map(); // norm name -> {qty, amt, raw}
for (const r of rows) {
  const it = (r["Item Name"] || "").toString().trim(); if (!it) continue;
  const q = numv(r["Item Qty"]), a = numv(r["Est Amount"]);
  const k = norm(it); const e = o2d.get(k) || { qty: 0, amt: 0, raw: it };
  e.qty += q; e.amt += a; o2d.set(k, e);
}
const unitValOf = new Map();
for (const [k, e] of o2d) if (e.qty > 0 && e.amt > 0) unitValOf.set(k, e.amt / e.qty);
const allVals = [...unitValOf.values()].filter((v) => v > 0);
// mean (not median) — long-tail items have ~0 rough value which would zero-out the median;
// the mean keeps unmatched items at a fair qty-proportional weight.
const medianVal = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 5;

// 2) match to sales_products, set unit_value, recompute value-weight + breakeven core
const prods = (await db.from("sales_products").select("id,name,total_qty_sold")).data || [];
let matched = 0;
const enriched = prods.map((p) => {
  const uv = unitValOf.get(norm(p.name));
  if (uv != null) matched++;
  const unit_value = uv != null ? Math.round(uv * 10) / 10 : null;
  const weight = (p.total_qty_sold || 0) * (uv != null ? uv : medianVal);
  return { ...p, unit_value, weight };
});
enriched.sort((a, b) => b.weight - a.weight);
const grand = enriched.reduce((s, p) => s + p.weight, 0);
let cum = 0;
for (const p of enriched) { cum += p.weight; p.core = cum <= CORE_COVERAGE * grand; }

console.log(`O2D items: ${o2d.size} | with value: ${unitValOf.size} | median Rs/unit: ${medianVal.toFixed(1)}`);
console.log(`sales_products: ${prods.length} | matched value: ${matched}`);
console.log(`new VALUE-based core: ${enriched.filter((p) => p.core).length} (was 80 by qty)`);

if (APPLY) {
  for (const p of enriched) {
    await db.from("sales_products").update({
      unit_value: p.unit_value,
      is_breakeven: !!p.core,
      updated_at: new Date().toISOString(),
    }).eq("id", p.id);
  }
  console.log(`\n✅ Stored unit_value + re-flagged breakeven core by VALUE for ${enriched.length} products.`);
}

// show items that NEWLY qualify as core thanks to value (high Rs/unit)
console.log("\n--- Top 12 core items by value-weight (qty x rough Rs/unit) ---");
console.log("  Rs/unit   qty       value-wt   item");
for (const p of enriched.filter((p) => p.core).slice(0, 12)) {
  console.log(`  ${String(p.unit_value ?? "?").padStart(6)}  ${String(Math.round(p.total_qty_sold)).padStart(8)}  ${String(Math.round(p.weight)).padStart(10)}  ${p.name}`);
}
console.log("\n--- High-value items (>= Rs 25/unit) now in core ---");
for (const p of enriched.filter((p) => p.core && (p.unit_value ?? 0) >= 25)) console.log(`  Rs ${p.unit_value}/u  ${p.name}`);
