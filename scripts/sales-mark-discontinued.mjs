/**
 * Mark items discontinued (is_active=false) from the stock sheet's
 * "Stock List" Status (Yes/No) column. Status = No -> discontinued.
 * Items not in the stock list keep is_active = true (still sold, just not
 * listed in the customer stock app).
 *
 * Apply: node scripts/sales-mark-discontinued.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const STOCK_ID = "1jNYhM-pkzGvV13ggc7LaRpe5zFz5PWe9oxLhBSWSy20";
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

const res = await fetch(`https://docs.google.com/spreadsheets/d/${STOCK_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent("Stock List")}`);
const rows = JSON.parse((await res.text()).match(/setResponse\((.*)\);?\s*$/s)[1]).table.rows;
const status = new Map(); // normName -> "Yes"/"No"
for (const r of rows) {
  const prod = r.c[1]?.v, st = r.c[3]?.v;
  if (prod && st != null && !/product/i.test(String(prod))) status.set(norm(prod), String(st).trim());
}
const discontinued = new Set([...status.entries()].filter(([, v]) => /^no$/i.test(v)).map(([k]) => k));
console.log(`Stock List rows: ${status.size} | marked discontinued (Status=No): ${discontinued.size}`);

const prods = (await db.from("sales_products").select("id,name,total_qty_sold,is_breakeven")).data || [];
const toDeactivate = prods.filter((p) => discontinued.has(norm(p.name)));
console.log(`\nsales_products to mark inactive: ${toDeactivate.length} (their qty still counts in category totals)`);
console.log("Examples (name · lifetime qty · was breakeven):");
for (const p of toDeactivate.sort((a, b) => b.total_qty_sold - a.total_qty_sold).slice(0, 15)) {
  console.log(`  ${p.name.padEnd(26)} ${String(Math.round(p.total_qty_sold)).padStart(8)}  ${p.is_breakeven ? "★ breakeven" : ""}`);
}

if (APPLY) {
  // reset all to active, then deactivate the discontinued set
  await db.from("sales_products").update({ is_active: true }).neq("id", "00000000-0000-0000-0000-000000000000");
  for (const p of toDeactivate) await db.from("sales_products").update({ is_active: false }).eq("id", p.id);
  console.log(`\n✅ Marked ${toDeactivate.length} items discontinued (is_active=false).`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
