/**
 * Refresh Churn Radar from the current O2D export — WITHOUT touching phones,
 * targets, products or order tables. Churn uses only sales_customers'
 * first_order_at / last_order_at / total_orders, so we recompute just those
 * per customer from the O2D (real dates only, capped at today).
 *
 * Apply: node scripts/sales-refresh-churn.mjs --apply
 */
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const O2D = process.env.O2D_CSV || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/CA17EB4D-7604-468A-AEAC-7ECA4D749719/O2D_Export_2026-06-02 (1).csv";
const TODAY = new Date("2026-06-04T23:59:59Z");
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

function parseDate(v) {
  const n = parseFloat(String(v));
  if (!isNaN(n) && n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // dd/mm/yyyy (Indian)
  if (m) return new Date(`${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}T00:00:00Z`);
  return null;
}

const wb = xlsx.readFile(O2D, { raw: false });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

// group by party → {orders:Set, dates:[]}
const byParty = new Map();
for (const r of rows) {
  const party = String(r["Party Name"] || "").trim(); if (!party) continue;
  const d = parseDate(r["Created At"]); if (!d || isNaN(d) || d > TODAY) continue; // skip bad/future
  const k = norm(party);
  if (!byParty.has(k)) byParty.set(k, { orders: new Set(), min: d, max: d });
  const e = byParty.get(k);
  e.orders.add(String(r["Order No"] || "").trim());
  if (d < e.min) e.min = d; if (d > e.max) e.max = d;
}

const custs = (await db.from("sales_customers").select("id,name,last_order_at")).data || [];
let updated = 0; const sample = []; const unmatched = [];
for (const c of custs) {
  const e = byParty.get(norm(c.name));
  if (!e) continue;
  const total = e.orders.size;
  const seg = total >= 30 ? "high" : total >= 8 ? "mid" : "low";
  if (APPLY) {
    await db.from("sales_customers").update({
      first_order_at: e.min.toISOString(), last_order_at: e.max.toISOString(),
      total_orders: total, segment: seg, updated_at: new Date().toISOString(),
    }).eq("id", c.id);
  }
  updated++;
  if (sample.length < 10) sample.push(`${c.name}: ${c.last_order_at?.slice(0, 10) || "—"} → ${e.max.toISOString().slice(0, 10)} (${total} ord)`);
}
// O2D parties with no matching customer (new customers we don't track yet)
for (const [k] of byParty) if (!custs.some((c) => norm(c.name) === k)) unmatched.push(k);

console.log(`O2D parties (with real dates): ${byParty.size}`);
console.log(`${APPLY ? "Updated" : "Would update"} ${updated} existing customers' churn dates.`);
console.log(`Unmatched O2D parties (not in our customer list): ${unmatched.length}`);
console.log("\nSample (old last → new last):");
for (const s of sample) console.log("  " + s);
if (!APPLY) console.log("\n(preview — re-run with --apply)");
