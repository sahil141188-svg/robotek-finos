/**
 * Rebuild seasonality + every active item's monthly target from the last 12
 * COMPLETE months of real orders (Jun 2025 → May 2026) + 10%. This:
 *   • derives a real seasonal index (May–Oct hot) from actual data
 *   • gives EVERY active item a target (so all categories show a target,
 *     not just the value-core) — fixes "Polymer Battery shows —"
 *
 * Writes: lib/sales/seasonal-index.json + sales_products.monthly_target_qty
 * Apply: node scripts/sales-rebuild-targets-2025.mjs --apply
 */
import xlsx from "xlsx";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const O2D = process.env.O2D_CSV || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/CA17EB4D-7604-468A-AEAC-7ECA4D749719/O2D_Export_2026-06-02 (1).csv";
const UPLIFT = 1.10;
const WIN_START = new Date("2025-06-01T00:00:00Z");
const WIN_END = new Date("2026-05-31T23:59:59Z"); // 12 complete months
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");
const numv = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
function parseDate(v) {
  const n = parseFloat(String(v));
  if (!isNaN(n) && n > 40000 && n < 60000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000));
  const m = String(v ?? "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(`${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}T00:00:00Z`);
  return null;
}

const wb = xlsx.readFile(O2D, { raw: false });
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

const monthQty = Array(13).fill(0);          // calendar month -> qty (window)
const itemQty = new Map();                   // norm item -> qty (window)
for (const r of rows) {
  const d = parseDate(r["Created At"]); if (!d || d < WIN_START || d > WIN_END) continue;
  const q = numv(r["Item Qty"]); const it = String(r["Item Name"] || "").trim(); if (!it) continue;
  monthQty[d.getUTCMonth() + 1] += q;
  itemQty.set(norm(it), (itemQty.get(norm(it)) || 0) + q);
}

// seasonal index (every month present in a 12-month window)
const present = [...Array(13).keys()].filter((m) => m >= 1 && monthQty[m] > 0);
const avgMonth = present.reduce((a, m) => a + monthQty[m], 0) / present.length;
const idx = {}; for (let m = 1; m <= 12; m++) idx[m] = monthQty[m] > 0 ? Math.round((monthQty[m] / avgMonth) * 100) / 100 : 1;

const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
console.log("Seasonal curve from Jun-2025 → May-2026 (qty):");
for (let m = 1; m <= 12; m++) console.log(`  ${MONTHS[m]}  ${idx[m].toFixed(2)}x  ${"█".repeat(Math.round(idx[m] * 14))}`);

// per-item target for ACTIVE products
const prods = (await db.from("sales_products").select("id,name,is_active,category")).data || [];
const catTotal = new Map();
const updates = prods.map((p) => {
  const wq = itemQty.get(norm(p.name)) || 0;
  const monthly = p.is_active && wq > 0 ? Math.round((wq / 12) * UPLIFT) : (p.is_active ? 0 : null);
  if (p.is_active) catTotal.set(p.category || "OTHER", (catTotal.get(p.category || "OTHER") || 0) + (monthly || 0));
  return { id: p.id, monthly };
});

console.log("\nCategory monthly target (baseline, active items):");
for (const [c, n] of [...catTotal.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(22)} ${n.toLocaleString("en-IN")}`);

if (APPLY) {
  // write seasonal index
  const json = { _comment: "Demand seasonality from last 12 complete months (Jun 2025–May 2026), actual order qty. multiplier of an average month.", _provisional: [] };
  for (let m = 1; m <= 12; m++) json[m] = idx[m];
  writeFileSync(new URL("../lib/sales/seasonal-index.json", import.meta.url), JSON.stringify(json, null, 2) + "\n");
  // write item targets
  for (const u of updates) await db.from("sales_products").update({ monthly_target_qty: u.monthly, updated_at: new Date().toISOString() }).eq("id", u.id);
  console.log(`\n✅ Wrote seasonal-index.json + monthly targets for ${updates.length} products.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
