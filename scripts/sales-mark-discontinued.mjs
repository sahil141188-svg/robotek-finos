/**
 * Mark items discontinued (is_active=false) — conservatively.
 *
 * "Discontinued = not in the current Stock List" (per Sahil), BUT order-system
 * names don't exactly match the Stock List, so we fuzzy-match first (exact,
 * ANS-prefix strip, containment). An item is marked discontinued ONLY if it
 * matches nothing in the catalog AND its lifetime qty is below QTY_GUARD — so a
 * real seller (a name variant) is never wrongly removed; big unmatched names
 * stay active and are listed for manual review.
 *
 * Discontinued rows are kept, so their qty still counts in CATEGORY totals.
 *
 * Apply: node scripts/sales-mark-discontinued.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const STOCK_ID = "1jNYhM-pkzGvV13ggc7LaRpe5zFz5PWe9oxLhBSWSy20";
const QTY_GUARD = 3000; // never auto-discontinue an item with >= this lifetime qty
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");
const core = (s) => norm(s).replace(/^ANS/, ""); // strip leading ANS brand

const res = await fetch(`https://docs.google.com/spreadsheets/d/${STOCK_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent("Stock List")}`);
const rows = JSON.parse((await res.text()).match(/setResponse\((.*)\);?\s*$/s)[1]).table.rows;
const catNorm = new Set(), catCore = [];
for (const r of rows) {
  const p = r.c[1]?.v; if (!p || /product/i.test(String(p))) continue;
  catNorm.add(norm(p)); const c = core(p); if (c.length >= 4) catCore.push(c);
}
function inCatalog(name) {
  const n = norm(name), c = core(name);
  if (catNorm.has(n) || catNorm.has(c)) return true;
  // containment either way against catalog cores (handles "Galaxy-V8" vs "ANS Galaxy-V8" etc.)
  for (const cc of catCore) {
    if (cc.length >= 5 && (n.includes(cc) || c.includes(cc) || cc.includes(c))) return true;
  }
  return false;
}

const prods = (await db.from("sales_products").select("id,name,total_qty_sold,is_breakeven")).data || [];
const active = [], discontinued = [], protectedBig = [];
for (const p of prods) {
  if (inCatalog(p.name)) active.push(p);
  else if ((p.total_qty_sold || 0) < QTY_GUARD) discontinued.push(p);
  else protectedBig.push(p); // unmatched but high volume → keep active, review
}
console.log(`Stock List products: ${catNorm.size}`);
console.log(`sales_products: ${prods.length}`);
console.log(`  ACTIVE (matched catalog):                 ${active.length}`);
console.log(`  KEPT ACTIVE (unmatched but qty>=${QTY_GUARD}, review): ${protectedBig.length}`);
console.log(`  DISCONTINUED (unmatched + low qty):        ${discontinued.length}`);
console.log("\nKept-active-for-review (unmatched big names — likely catalog variants):");
for (const p of protectedBig.sort((a, b) => b.total_qty_sold - a.total_qty_sold).slice(0, 15))
  console.log(`  ${p.name.slice(0, 30).padEnd(32)} ${String(Math.round(p.total_qty_sold)).padStart(8)}`);

if (APPLY) {
  await db.from("sales_products").update({ is_active: true }).neq("id", "00000000-0000-0000-0000-000000000000");
  for (const p of discontinued) await db.from("sales_products").update({ is_active: false }).eq("id", p.id);
  console.log(`\n✅ Marked ${discontinued.length} discontinued; ${prods.length - discontinued.length} stay active.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
