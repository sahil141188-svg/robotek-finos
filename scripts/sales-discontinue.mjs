/**
 * Mark dealers as discontinued (status='discontinued') so they drop out of
 * Churn Radar / active counts / push lists. Matches by all-tokens-present so
 * "Patel Raipur" finds "Patel Mobile Raipur".
 *
 * Usage: node scripts/sales-discontinue.mjs --apply ["Name One" "Name Two" ...]
 * Defaults to the known discontinued list when no names are given.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const argNames = process.argv.slice(2).filter((a) => a !== "--apply");
const TARGETS = argNames.length ? argNames : [
  "DK Jpr", "Patel Raipur", "shree ji mobile surat", "Suvidha Banglore", "Nakul enterprises",
];

const toks = (s) => (s || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").split(/\s+/).filter((t) => t.length >= 2);
const custs = (await db.from("sales_customers").select("id,name,status")).data || [];

const matched = [], notFound = [];
for (const t of TARGETS) {
  const tt = toks(t);
  const hit = custs.find((c) => { const cn = toks(c.name); return tt.every((x) => cn.includes(x)); });
  if (hit) matched.push(hit); else notFound.push(t);
}
console.log("To discontinue:");
for (const m of matched) console.log(`  ✓ ${m.name}`);
if (notFound.length) console.log("Not found:", notFound.join(" | "));

if (APPLY) {
  for (const m of matched) await db.from("sales_customers").update({ status: "discontinued", updated_at: new Date().toISOString() }).eq("id", m.id);
  console.log(`\n✅ Marked ${matched.length} customers discontinued.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
