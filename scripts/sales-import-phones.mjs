/**
 * Import dealer phone numbers into sales_customers from "customer list.xlsx"
 * (cols: Clients Name, Firm name, Mobno) by fuzzy-matching firm/client names.
 *
 * Auto-applies only HIGH-confidence matches (exact, substring, 2+ shared
 * tokens, or a distinctive shared token). LOW-confidence + unmatched are
 * printed for manual review — never auto-applied (wrong number = wrong dealer).
 *
 * Apply:  node scripts/sales-import-phones.mjs --apply
 * Preview only (default): node scripts/sales-import-phones.mjs
 */
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const XLSX_PATH = process.env.PHONE_XLSX || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/53D0752D-6C38-475C-BD7C-F57885BC8E58/customer list.xlsx";

const STOP = new Set(["JI", "MOBILE", "ENTERPRISES", "ENTERPRISE", "MS", "AND", "THE", "SHRI", "SREE", "SRI", "TELECOM", "TRADERS", "TRADING", "COMMUNICATION", "COMMUNICATIONS", "STORE", "COLLECTION", "ELECTRONICS", "COMPANY", "ACCESSORIES", "SALES", "MARKETING", "DISTRIBUTORS", "BHAI", "AGENCIES", "AGENCEIES", "CONSUMABLE"]);
const COMMON = new Set(["ASHISH", "ROHIT", "RAHUL", "DEEPAK", "SONU", "MANISH", "RAJ", "RAJU", "VINOD", "AMIT", "SUMIT", "RAVI", "SANJAY", "ANIL", "SUNIL", "RAKESH", "RAJESH", "MUKESH", "VIKAS", "VIKASH", "PANKAJ", "ABHISHEK", "ABHINAV", "KULDEEP", "DHEERAJ", "NAKUL", "ABHIMANYU", "KUSHAL", "GUDDU", "RAJA", "RABIN", "AZHAR", "SHOEB", "IJAZ", "ASIF", "AHMED", "NAMAN", "DEEP", "MOHD", "MD", "KUMAR", "SINGH", "KHAN", "RIDDHI", "SIDDHI"]);
const toks = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

const wb = xlsx.readFile(XLSX_PATH);
const xrows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const idx = xrows
  .map((r) => ({ phone: String(r["Mobno"] ?? "").replace(/\D/g, ""), tset: new Set([...toks(r["Clients Name"]), ...toks(r["Firm name"])]), normC: norm(r["Clients Name"]), normF: norm(r["Firm name"]), raw: r["Firm name"] || r["Clients Name"] || "" }))
  .filter((x) => x.phone.length >= 10);

const sales = (await db.from("sales_customers").select("id,name,phone")).data || [];
const high = [], low = [], unmatched = [];
for (const s of sales) {
  if (s.phone) continue;
  const stset = new Set(toks(s.name)), sn = norm(s.name);
  let best = null, bestShared = [], bestExact = false, bestSub = false, bestScore = -1;
  for (const x of idx) {
    const exact = sn && (sn === x.normC || sn === x.normF);
    const sub = sn.length >= 4 && (x.normF.includes(sn) || x.normC.includes(sn));
    const shared = [...stset].filter((t) => x.tset.has(t));
    const score = (exact ? 100 : 0) + (sub ? 10 : 0) + shared.length + shared.filter((t) => !COMMON.has(t) && t.length >= 5).length * 3;
    if (score > bestScore) { best = x; bestShared = shared; bestExact = exact; bestSub = sub; bestScore = score; }
  }
  if (!best || (bestShared.length === 0 && !bestExact && !bestSub)) { unmatched.push(s.name); continue; }
  const distinctive = bestShared.some((t) => !COMMON.has(t) && t.length >= 5);
  const isHigh = bestExact || bestSub || bestShared.length >= 2 || distinctive;
  (isHigh ? high : low).push({ id: s.id, s: s.name, to: best.raw, phone: best.phone, shared: bestShared.join("+") || (bestSub ? "substring" : "exact") });
}

console.log(`HIGH-confidence: ${high.length} | LOW (review): ${low.length} | unmatched: ${unmatched.length}`);
if (APPLY) {
  for (const m of high) await db.from("sales_customers").update({ phone: m.phone, updated_at: new Date().toISOString() }).eq("id", m.id);
  console.log(`\n✅ APPLIED ${high.length} high-confidence numbers to sales_customers.`);
}
console.log("\n--- HIGH (applied) — sales customer -> matched firm [shared token] ---");
for (const m of high) console.log(`  ${m.s.padEnd(26)} -> ${String(m.to).slice(0, 30).padEnd(32)} [${m.shared}]`);
console.log("\n--- LOW confidence (NOT applied — confirm these) ---");
for (const m of low) console.log(`  ${m.s.padEnd(26)} -> ${String(m.to).slice(0, 30).padEnd(32)} [${m.shared}]`);
console.log(`\n--- UNMATCHED (${unmatched.length}, no number found) ---`);
console.log("  " + unmatched.join(" | "));
