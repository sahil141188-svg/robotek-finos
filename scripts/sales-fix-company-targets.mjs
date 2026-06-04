/**
 * Fix company-level item targets using customer_item_targets as the source.
 *
 * Correct logic:
 *   company monthly_target_qty = SUM(avg_monthly_qty per customer × 1.10)
 *   where avg_monthly_qty = total_qty / months_active (already correct in customer targets).
 *
 * This handles:
 *   - New launches (few active months → target reflects real buying rate not /12)
 *   - Items like Rapid+Rapid-C that are separate SKUs but each get correct targets
 *   - Bulk buyers correctly weighted
 *
 * Apply: node scripts/sales-fix-company-targets.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const UPLIFT = 1.10;

// Aggregate customer_item_targets by product: sum of avg_monthly_qty per customer
// = company monthly demand rate across all dealers
async function all(cols) {
  const out = []; let f = 0;
  for (;;) {
    const { data } = await db.from("sales_customer_item_targets").select(cols).range(f, f + 999);
    out.push(...data); if (data.length < 1000) break; f += 1000;
  }
  return out;
}

const targets = await all("product_id,avg_monthly_qty,total_qty,months_active");
const prods = (await db.from("sales_products").select("id,name,monthly_target_qty,is_active")).data || [];
const prodMap = new Map(prods.map(p => [p.id, p]));

// Sum avg_monthly_qty per product (= demand rate across all dealers buying it)
const byProd = new Map();
for (const t of targets) {
  const avg = t.avg_monthly_qty ?? (t.months_active > 0 ? Math.round(t.total_qty / t.months_active) : 0);
  if (!avg) continue;
  byProd.set(t.product_id, (byProd.get(t.product_id) || 0) + avg);
}

// Build update list: only active products
const updates = [];
for (const [pid, sumAvg] of byProd) {
  const p = prodMap.get(pid);
  if (!p?.is_active) continue;
  const newTarget = Math.round(sumAvg * UPLIFT);
  updates.push({ id: pid, name: p.name, old: p.monthly_target_qty || 0, neu: newTarget });
}
updates.sort((a, b) => b.neu - a.neu);

console.log(`Products to update: ${updates.length}\n`);
console.log("Top 15 — OLD target vs CORRECTED target (active-month sum across all dealers + 10%):");
console.log("  item                            OLD/mo    NEW/mo   diff");
for (const u of updates.slice(0, 15)) {
  const diff = u.neu - u.old;
  const sign = diff > 0 ? "+" : "";
  console.log(`  ${u.name.padEnd(30)} ${String(u.old).padStart(8)} ${String(u.neu).padStart(8)}   ${sign}${diff}`);
}

// Rapid group
const rapidGroup = updates.filter(u => /^rapid/i.test(u.name));
console.log("\nRapid group:");
for (const u of rapidGroup) console.log(`  ${u.name}: ${u.old} → ${u.neu}`);
console.log("  COMBINED Rapid*:", rapidGroup.reduce((s,u)=>s+u.neu,0));

if (!APPLY) { console.log("\n(preview — re-run with --apply)"); process.exit(0); }

console.log("\nApplying…");
for (const u of updates) {
  await db.from("sales_products").update({ monthly_target_qty: u.neu, updated_at: new Date().toISOString() }).eq("id", u.id);
}
console.log(`✅ Updated ${updates.length} company item targets from active-month demand.`);
