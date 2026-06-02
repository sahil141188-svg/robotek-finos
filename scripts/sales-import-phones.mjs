/**
 * Import dealer phone numbers into sales_customers from "customer list.xlsx"
 * (cols: Clients Name, Firm name, Mobno).
 *
 * PRECISION-FIRST. Auto-applies a match ONLY when it's safe:
 *   • exact normalized name, OR
 *   • strong containment (one name fully inside the other, len>=6), OR
 *   • 2+ shared significant tokens, OR
 *   • a single shared token that is UNIQUE in the list (df==1), not a common
 *     first name, and length>=4.
 * Everything else → REVIEW list (a human must confirm). Single common-first-name
 * collisions (Ashish/Rohit/Krishna…) are never auto-applied.
 *
 * Rollback flag clears previously auto-applied numbers first (keeps the two
 * exact finance matches Garv / Kaveri Tronics).
 *
 * Apply: node scripts/sales-import-phones.mjs --apply
 */
import xlsx from "xlsx";
import { writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const XLSX_PATH = process.env.PHONE_XLSX || "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/53D0752D-6C38-475C-BD7C-F57885BC8E58/customer list.xlsx";
const KEEP = new Set(["Garv Enterprises/ Rewa", "Kaveri Tronics"]); // exact finance matches — trusted

const STOP = new Set(["JI", "MOBILE", "MOBILES", "ENTERPRISES", "ENTERPRISE", "ENT", "MS", "AND", "THE", "SHRI", "SHREE", "SREE", "SRI", "TELECOM", "TRADERS", "TRADER", "TRADING", "COMMUNICATION", "COMMUNICATIONS", "STORE", "COLLECTION", "ELECTRONICS", "COMPANY", "ACCESSORIES", "SALES", "MARKETING", "DISTRIBUTORS", "DISTRIBUTION", "BHAI", "AGENCIES", "AGENCEIES", "CONSUMABLE", "PVT", "LTD", "NEW", "MAA", "OM", "SAI", "JAI", "HARI"]);
const COMMON = new Set(["ASHISH", "ROHIT", "RAHUL", "DEEPAK", "SONU", "MANISH", "RAJ", "RAJU", "VINOD", "AMIT", "SUMIT", "RAVI", "SANJAY", "ANIL", "SUNIL", "RAKESH", "RAJESH", "MUKESH", "VIKAS", "VIKASH", "PANKAJ", "ABHISHEK", "ABHINAV", "KULDEEP", "DHEERAJ", "NAKUL", "ABHIMANYU", "KUSHAL", "GUDDU", "RAJA", "RABIN", "AZHAR", "SHOEB", "IJAZ", "ASIF", "AHMED", "NAMAN", "DEEP", "MOHD", "MD", "KUMAR", "SINGH", "KHAN", "RIDDHI", "SIDDHI", "KRISHNA", "JYOTI", "VIJAY", "PRAKASH", "DINESH", "SAHIL", "VINAY", "GOPAL", "SHUBHAM", "PRADEEP", "MURLI", "VISHAL", "LALIT", "ABBAS", "SUNNY", "NADEEM", "SHANKAR", "JATIN", "GAYATRI", "KAMAL", "RUSTAM", "ANURAG", "SONI", "BALA", "SURI", "JAIN", "ANIL", "MANOJ", "SACHIN", "VIKRAM", "ARUN", "AMARJIT", "SHOKAT", "AZHAR", "SK", "RP"]);
const toks = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
const norm = (s) => (s || "").toString().toUpperCase().replace(/[^A-Z0-9]+/g, "");

const wb = xlsx.readFile(XLSX_PATH);
const xrows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
const idx = xrows
  .map((r) => ({ phone: String(r["Mobno"] ?? "").replace(/\D/g, ""), tset: new Set([...toks(r["Clients Name"]), ...toks(r["Firm name"])]), normC: norm(r["Clients Name"]), normF: norm(r["Firm name"]), raw: r["Firm name"] || r["Clients Name"] || "" }))
  .filter((x) => x.phone.length >= 10);

// document frequency of each token across the list (how many firms contain it)
const df = new Map();
for (const x of idx) for (const t of x.tset) df.set(t, (df.get(t) || 0) + 1);

const sales = (await db.from("sales_customers").select("id,name,phone")).data || [];

if (APPLY) {
  // rollback prior auto-applied numbers (keep trusted finance matches)
  let cleared = 0;
  for (const s of sales) if (s.phone && !KEEP.has(s.name)) { await db.from("sales_customers").update({ phone: null }).eq("id", s.id); cleared++; }
  console.log(`Rolled back ${cleared} previously-applied numbers (kept ${KEEP.size} trusted).`);
}

const accept = [], review = [], unmatched = [];
for (const s of sales) {
  if (KEEP.has(s.name)) continue;
  const stset = new Set(toks(s.name)), sn = norm(s.name);
  let best = null, bestShared = [], bestExact = false, bestContain = false, bestScore = -1;
  for (const x of idx) {
    const exact = sn && (sn === x.normC || sn === x.normF);
    // containment only on the FIRM name, length>=7 (avoids short coincidental client substrings)
    const contain = (sn.length >= 7 && x.normF.includes(sn)) || (x.normF.length >= 7 && sn.includes(x.normF));
    const shared = [...stset].filter((t) => x.tset.has(t));
    const score = (exact ? 100 : 0) + (contain ? 50 : 0) + shared.length;
    if (score > bestScore) { best = x; bestShared = shared; bestExact = exact; bestContain = contain; bestScore = score; }
  }
  if (!best || (bestShared.length === 0 && !bestExact && !bestContain)) { unmatched.push(s.name); continue; }
  const uniqueDistinctive = bestShared.length === 1 && df.get(bestShared[0]) === 1 && !COMMON.has(bestShared[0]) && bestShared[0].length >= 4;
  const safe = bestExact || bestContain || bestShared.length >= 2 || uniqueDistinctive;
  const rec = { id: s.id, s: s.name, to: best.raw, phone: best.phone, why: bestExact ? "exact" : bestContain ? "contains" : bestShared.length >= 2 ? bestShared.join("+") : `${bestShared[0]}(uniq)` };
  (safe ? accept : review).push(rec);
}

// demote any phone claimed by 2+ different customers (ambiguous → review, don't auto-apply)
const phoneCount = new Map();
for (const m of accept) phoneCount.set(m.phone, (phoneCount.get(m.phone) || 0) + 1);
const safeAccept = accept.filter((m) => phoneCount.get(m.phone) === 1);
const demoted = accept.filter((m) => phoneCount.get(m.phone) > 1);
review.push(...demoted);
accept.length = 0; accept.push(...safeAccept);

console.log(`\nSAFE auto-apply: ${accept.length} | REVIEW (uncertain): ${review.length} | unmatched: ${unmatched.length}`);
if (APPLY) {
  for (const m of accept) await db.from("sales_customers").update({ phone: m.phone, updated_at: new Date().toISOString() }).eq("id", m.id);
  console.log(`✅ Applied ${accept.length} safe matches (+ ${KEEP.size} trusted finance = ${accept.length + KEEP.size} total with numbers).`);
}
console.log("\n--- SAFE (applied) sales -> firm [why] ---");
for (const m of accept) console.log(`  ${m.s.padEnd(26)} -> ${String(m.to).slice(0, 30).padEnd(32)} [${m.why}]`);
console.log("\n--- REVIEW (NOT applied — uncertain guesses, confirm before sending) ---");
for (const m of review) console.log(`  ${m.s.padEnd(26)} -> ${String(m.to).slice(0, 30).padEnd(32)} ...${m.phone.slice(-4)}`);
console.log(`\n--- UNMATCHED (${unmatched.length}) ---\n  ` + unmatched.join(" | "));

// write a review CSV: confirm/fix the uncertain guesses, then re-import the confirmed rows
const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const csv = ["sales_customer,guessed_firm,phone,keep? (y/n),correct_phone_if_no"]
  .concat(review.map((m) => [m.s, m.to, m.phone, "", ""].map(esc).join(",")))
  .concat(unmatched.map((u) => [u, "", "", "", ""].map(esc).join(",")))
  .join("\n");
writeFileSync("sales_phone_review.csv", csv);
console.log(`\n📄 Wrote sales_phone_review.csv (${review.length} uncertain + ${unmatched.length} unmatched) for your confirmation.`);

// also write a 3-tab Excel workbook to the Desktop (open in Excel or upload to Google Sheets)
const applied = (await db.from("sales_customers").select("name,phone").not("phone", "is", null).order("name")).data || [];
const wbOut = xlsx.utils.book_new();
const reviewAOA = [["Sales Customer", "Guessed Firm", "Phone (guess)", "Keep? (y/n)", "Correct phone if NO"], ...review.map((m) => [m.s, m.to, m.phone, "", ""])];
const missingAOA = [["Sales Customer", "Phone (please fill)"], ...unmatched.map((u) => [u, ""])];
const appliedAOA = [["Sales Customer", "Phone (already applied)"], ...applied.map((a) => [a.name, a.phone])];
xlsx.utils.book_append_sheet(wbOut, xlsx.utils.aoa_to_sheet(reviewAOA), "1 Review (confirm y-n)");
xlsx.utils.book_append_sheet(wbOut, xlsx.utils.aoa_to_sheet(missingAOA), "2 Missing (add number)");
xlsx.utils.book_append_sheet(wbOut, xlsx.utils.aoa_to_sheet(appliedAOA), "3 Applied (done)");
const outPath = `${process.env.HOME}/Desktop/Robotek_sales_phones.xlsx`;
xlsx.writeFile(wbOut, outPath);
console.log("📊 Excel workbook:", outPath);
