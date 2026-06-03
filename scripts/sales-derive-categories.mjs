/**
 * Derive a product CATEGORY (series) for each item from its name prefix —
 * e.g. "DC 101" -> DC, "HF TAAL" -> HF, "ANS TWS STAR" -> ANS, "W16" -> W,
 * "S19 MAX" -> S, "Rapid-C" -> RAPID. A pragmatic auto-grouping; rename later.
 *
 * Apply: node scripts/sales-derive-categories.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

function categoryOf(name) {
  const n = (name || "").trim();
  const m = n.match(/^[A-Za-z]+/);          // leading alpha run
  let cat = m ? m[0].toUpperCase() : "OTHER";
  if (cat.length <= 1) cat = (n.match(/^[A-Za-z0-9]+/)?.[0] || "OTHER").toUpperCase(); // single letter like S/W -> keep
  return cat;
}

const prods = (await db.from("sales_products").select("id,name,is_breakeven")).data || [];
const byCat = new Map();
for (const p of prods) {
  const c = categoryOf(p.name);
  if (!byCat.has(c)) byCat.set(c, { n: 0, breakeven: 0 });
  byCat.get(c).n++; if (p.is_breakeven) byCat.get(c).breakeven++;
}
const sorted = [...byCat.entries()].sort((a, b) => b[1].n - a[1].n);
console.log(`Products: ${prods.length} | distinct categories: ${byCat.size}`);
console.log("\nTop categories (count · breakeven):");
for (const [c, v] of sorted.slice(0, 25)) console.log(`  ${c.padEnd(12)} ${String(v.n).padStart(4)}  ·  ${v.breakeven}`);

if (APPLY) {
  for (const p of prods) await db.from("sales_products").update({ category: categoryOf(p.name) }).eq("id", p.id);
  console.log(`\n✅ Stored category on ${prods.length} products.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
