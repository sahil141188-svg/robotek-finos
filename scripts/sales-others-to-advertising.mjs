/**
 * Move non-product branding / incentive / merch items out of "Others" into an
 * "Advertising Material" category and mark them inactive (excluded from targets).
 * These are dealer giveaways (T-shirts, bags, bottles, umbrellas, TVs, posters…),
 * not sellable SKUs. Categorising (not deleting) preserves their order history.
 *
 * Apply: node scripts/sales-others-to-advertising.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

const MERCH = /(BAG|BOTTLE|BOTTEL|THALI|THELLA|SHIRT|HOODY|\bCAP\b|UMBRELLA|KETTLE|\bTV\b|\bLED\b|INDUCTION|RACKET|\bPEN\b|NOTEPAD|STICKER|POSTER|DIARY|TAPE|DIYA|LUNCHBOX|TIFFIN|KADAHI|KADHAI|UTENSIL|BEDSHEET|DINNER ?SET|COMFORTOR|GLOW ?SHINE|\bBOARD\b|JUGNOO|LOTUS|FRIDGE|TROLL|FOLDING|GRAVITY|DISPLAY|GRIP|IRON LIGHT|WALL ACCESSOR|JALL|\bRGB\b|STEEL|DINNER)/i;

const others = (await db.from("sales_products").select("id,name").eq("category", "Others")).data || [];
const move = [], keep = [];
for (const p of others) (MERCH.test(p.name) ? move : keep).push(p);

console.log(`Others: ${others.length} | → Advertising Material: ${move.length} | stay in Others: ${keep.length}\n`);
console.log("--- MOVING to Advertising Material (inactive) ---");
for (const p of move) console.log("  " + p.name);
console.log("\n--- STAYING in Others (sellable accessories: chargers, mics, doorbells…) ---");
for (const p of keep) console.log("  " + p.name);

if (APPLY) {
  for (const p of move) await db.from("sales_products").update({ category: "Advertising Material", is_active: false }).eq("id", p.id);
  console.log(`\n✅ Moved ${move.length} items to Advertising Material (inactive).`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
