/**
 * Mark products active/discontinued from the current Stock List.
 *   • in stock list, Status = Yes  -> active
 *   • in stock list, Status = No   -> discontinued
 *   • NOT in stock list            -> discontinued  (Sahil's rule)
 * Target queries already filter is_active=true, so discontinued items drop out
 * of all target views automatically.
 *
 * Apply: node scripts/sales-set-active-from-stocklist.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const STOCK_ID = "1jNYhM-pkzGvV13ggc7LaRpe5zFz5PWe9oxLhBSWSy20";
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

const toks = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(/\s+/).filter((t) => t.length >= 2);

// stock list: Category | Product Name | Box Qty | Status(Yes/No) | ...
const res = await fetch(`https://docs.google.com/spreadsheets/d/${STOCK_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent("Stock List")}`);
const rows = JSON.parse((await res.text()).match(/setResponse\((.*)\);?\s*$/s)[1]).table.rows;
const stockItems = []; // {norm, tset, status}
for (const r of rows) {
  const prod = r.c[1]?.v, status = r.c[3]?.v;
  if (prod && !/product\s*name/i.test(String(prod))) stockItems.push({ norm: norm(prod), tset: new Set(toks(prod)), status: String(status ?? "Yes").trim().toUpperCase() });
}
console.log("stock-list products:", stockItems.length);

// match a sales product to a stock item: exact-norm, token-subset (either way), or jaccard>=0.5
function matchStock(name) {
  const sn = norm(name), st = new Set(toks(name));
  let best = null, bestScore = 0;
  for (const s of stockItems) {
    if (sn && sn === s.norm) return s;
    if (st.size === 0 || s.tset.size === 0) continue;
    const shared = [...st].filter((t) => s.tset.has(t)).length;
    if (shared === 0) continue;
    const subset = shared === st.size || shared === s.tset.size;
    const jac = shared / (st.size + s.tset.size - shared);
    const score = subset ? 1 + jac : jac;
    if ((subset || jac >= 0.5) && score > bestScore) { bestScore = score; best = s; }
  }
  return best;
}

const prods = (await db.from("sales_products").select("id,name,is_breakeven,is_active")).data || [];
let active = 0, inactive = 0, breakDeact = 0; const breakDeactNames = [];
const updates = prods.map((p) => {
  const m = matchStock(p.name);
  const isActive = m ? m.status !== "NO" : false; // not in stock list -> discontinued
  if (isActive) active++; else { inactive++; if (p.is_breakeven) { breakDeact++; if (breakDeactNames.length < 40) breakDeactNames.push(p.name); } }
  return { id: p.id, isActive };
});
console.log(`\nWould set: active ${active} | discontinued ${inactive} (was active ${prods.filter((p) => p.is_active).length})`);
console.log(`Breakeven/target items being discontinued: ${breakDeact}`);
if (breakDeactNames.length) console.log("  " + breakDeactNames.join(", "));

if (APPLY) {
  for (const u of updates) await db.from("sales_products").update({ is_active: u.isActive }).eq("id", u.id);
  console.log(`\n✅ Updated is_active on ${updates.length} products. Discontinued items now excluded from all targets.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
