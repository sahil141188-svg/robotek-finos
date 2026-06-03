/**
 * Map every sales_product to Robotek's REAL categories (from the stock sheet's
 * Category | Product Name table). Exact name match wins; prefix rules fill the
 * rest (mostly battery variants not in the stock list).
 *
 * Real categories: Data Cable, Smart Charger, Power Series, Neck Band, TWS,
 * Hands Free, Power Bank, Speaker, Batteries - Robotek, ANS Longer,
 * Polymer Battery, Others.
 *
 * Apply: node scripts/sales-map-real-categories.mjs --apply
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const STOCK_ID = "1jNYhM-pkzGvV13ggc7LaRpe5zFz5PWe9oxLhBSWSy20";
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

// 1) pull the Category|Product table from the stock sheet (try the "Stock" tab)
async function loadStockMap() {
  const map = new Map();
  for (const q of [`&sheet=${encodeURIComponent("Stock List")}`, `&sheet=Stock`, ``]) {
    try {
      const res = await fetch(`https://docs.google.com/spreadsheets/d/${STOCK_ID}/gviz/tq?tqx=out:json${q}`);
      const raw = await res.text();
      const m = raw.match(/setResponse\((.*)\);?\s*$/s);
      if (!m) continue;
      const rows = JSON.parse(m[1]).table.rows;
      for (const r of rows) {
        const cat = r.c[0]?.v, prod = r.c[1]?.v;
        if (cat && prod && !/category/i.test(String(cat))) map.set(norm(prod), String(cat).trim());
      }
      if (map.size > 50) break;
    } catch { /* try next */ }
  }
  return map;
}

// 2) prefix rules (ordered — specific first) for items not in the stock list
const RULES = [
  [/^(DC|OTG|PBC|RAPID|SW|FASTER|AC0)/, "Data Cable"],
  [/^(CC|GATI|BOOT|PD|SC|QC|UC|GALAXY)/, "Smart Charger"],
  [/^PS\s*\d/, "Power Series"],
  [/^(NB|RBH|FIGHTER)/, "Neck Band"],
  [/^(TWS|SOUNDPOD|YOYO|AIRMUTE|SUPERBUDDY|EASYBUDDY|EASY BUDDY)/, "TWS"],
  [/^(HF|WH|EARPHONE|X300|X909|X505|X606|X888|X111|X1101)/, "Hands Free"],
  [/^(SPKR|SPK|GOONZ|GLIDER|RETRO|JUKEBOX|MELODY|MONSTER|JALWA|TARANG|HUNGAMA|AVATAR|DHAMAKA|DHURANDHAR|DHUN|TRUMP|MEGAPHONE)/, "Speaker"],
  [/^(S\d|W\d)/, "Power Bank"],
  [/^RB/, "Batteries - Robotek"],
  [/^LB/, "ANS Longer"],
  [/^(PB|BLP|BA|BM|BP|BZ|BN|BK|BL|IP|B-|B[A-Z]?\d)/, "Polymer Battery"],
];
function prefixCategory(name) {
  // strip a leading "ANS " brand prefix so the real type token is matched
  const u = (name || "").toUpperCase().trim().replace(/^ANS\s+/, "");
  for (const [re, cat] of RULES) if (re.test(u)) return cat;
  return "Others";
}

const stock = await loadStockMap();
console.log(`Stock-sheet product→category entries: ${stock.size}`);

const prods = (await db.from("sales_products").select("id,name")).data || [];
let exact = 0;
const counts = new Map();
const updates = prods.map((p) => {
  let cat = stock.get(norm(p.name));
  if (cat) exact++; else cat = prefixCategory(p.name);
  counts.set(cat, (counts.get(cat) || 0) + 1);
  return { id: p.id, cat };
});
console.log(`Matched exactly to stock sheet: ${exact} of ${prods.length} (rest by prefix)\n`);
console.log("Final category distribution:");
for (const [c, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.padEnd(22)} ${n}`);

if (APPLY) {
  for (const u of updates) await db.from("sales_products").update({ category: u.cat }).eq("id", u.id);
  console.log(`\n✅ Mapped ${updates.length} products to real categories.`);
} else {
  console.log("\n(preview — re-run with --apply)");
}
