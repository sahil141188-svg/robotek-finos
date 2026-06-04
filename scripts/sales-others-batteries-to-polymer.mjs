/**
 * Move phone-model BATTERIES currently sitting in "Others" into "Polymer Battery".
 * Conservative: an item moves only if it looks like a phone battery (brand/model
 * tokens or Samsung EB- codes) AND is not an obvious physical-good / charger /
 * neckband / merch item.
 *
 * Apply: node scripts/sales-others-batteries-to-polymer.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");

// positive: looks like a phone battery
const BATTERY = [
  /\b(VIVO|MOTO|MOTOROLA|HONOR|OPPO|REALME|REDMI|POCO|SAMSUNG|ONEPLUS|IQOO|NOVA|INFINIX|TECNO|ENJOY|HUA)\b/,
  /EB-?B[AMJ]/, /SCUD/,
  /^(SM|SMG|BW|BS|BG|BT|NH|MH|JK|HE|HC|QF|RM|VI|OP)[\s-]/,
  /^(QF|RM|NH|MH|JK|HE|HC|BW|BS|BG|BT|SMG|SM)\d/, // model code stuck to prefix (QF50, RM5…)
  /^V\d/,                     // V9 PRO, V17 PRO, V20SE (Vivo)
  /^\d+\s?(LITE|X)\b/,        // "9 LITE HONOR", "8X HONOR"
];
// negative: physical goods / chargers / neckbands / merch — never a battery
const NOT_BATTERY = /(BAG|BOTTLE|BOTTEL|THALI|THELLA|SHIRT|HOODY|CAP\b|UMBRELLA|KETTLE|\bTV\b|LED|INDUCTION|STAND|RACKET|\bPEN\b|NOTEPAD|STICKER|POSTER|DIARY|TAPE|DIYA|LUNCHBOX|TIFFIN|\bMIC\b|WM-11|CHARGER|DOORBELL|SAKSHAM|TIMER|SOCKET|KADAHI|UTENSIL|BEDSHEET|DINNER|COMFORTOR|GRIP|GLOW|BOARD|JUGNOO|LOTUS|UBH|RGB|WALL|JALL|FRIDGE|STEEL|TROLL|FOLDING|GRAVITY|ROCKPOD|ROCKBEAT|NECKBAND|RBH|EZEE|WATER|DISPLAY|TWS|\bKADAHI\b|GRIP GO)/i;

const others = (await db.from("sales_products").select("id,name,total_qty_sold").eq("category", "Others")).data || [];
const move = [], keep = [];
for (const p of others) {
  const u = p.name.toUpperCase();
  const isBat = BATTERY.some((re) => re.test(u)) && !NOT_BATTERY.test(u);
  (isBat ? move : keep).push(p);
}
console.log(`Others: ${others.length} | → Polymer Battery: ${move.length} | stay in Others: ${keep.length}\n`);
console.log("--- MOVING to Polymer Battery ---");
for (const p of move) console.log("  " + p.name);
console.log("\n--- STAYING in Others ---");
for (const p of keep) console.log("  " + p.name);

if (APPLY) {
  for (const p of move) await db.from("sales_products").update({ category: "Polymer Battery" }).eq("id", p.id);
  console.log(`\n✅ Moved ${move.length} batteries to Polymer Battery.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
