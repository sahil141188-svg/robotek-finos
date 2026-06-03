/**
 * Apply the confirmed phone numbers from the reviewed Google Sheet
 * (exported to /tmp/review.csv).
 *   keep = YES -> use phone_guess
 *   keep = NO  -> use correct_phone_if_no (if present)
 *   blank / NO-without-number -> skip
 * Numbers normalised to 10 digits. Matches sales_customers by exact name.
 *
 * Run: node scripts/sales-apply-phone-review.mjs [/path/to/review.csv]
 */
import xlsx from "xlsx";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const CSV = process.argv[2] || "/tmp/review.csv";

const norm10 = (s) => { let d = String(s || "").replace(/\D/g, ""); if (d.length === 12 && d.startsWith("91")) d = d.slice(2); if (d.length === 11 && d.startsWith("0")) d = d.slice(1); return d; };
const wb = xlsx.readFile(CSV);
const rows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
const sales = (await db.from("sales_customers").select("id,name")).data || [];
const byName = new Map(sales.map((s) => [s.name.trim().toUpperCase(), s.id]));

let applied = 0; const skipped = [], nomatch = []; let belowDivider = false;
for (const r of rows) {
  const name = String(r["sales_customer"] || "").trim();
  if (!name) continue;
  if (name.startsWith("---")) { belowDivider = true; continue; } // "no number found, please add" section
  const keep = String(r["keep? (y/n)"] || "").trim().toUpperCase();
  const guess = String(r["phone_guess"] || "").trim();
  const corr = String(r["correct_phone_if_no"] || "").trim();
  let phone = "";
  if (keep === "YES" || keep === "Y") phone = norm10(guess);
  else if (keep === "NO" || keep === "N") phone = norm10(corr);
  else if (belowDivider) phone = norm10(guess || corr); // newly-added numbers in the bottom section
  else { if (guess) skipped.push(`${name} (left blank)`); continue; }
  if (!phone || phone.length < 10) { skipped.push(`${name} (no number / discontinued)`); continue; }
  const id = byName.get(name.toUpperCase());
  if (!id) { nomatch.push(name); continue; }
  await db.from("sales_customers").update({ phone, updated_at: new Date().toISOString() }).eq("id", id);
  applied++;
}
const total = (await db.from("sales_customers").select("*", { count: "exact", head: true }).not("phone", "is", null)).count;
console.log(`✅ Applied ${applied} numbers from the review.`);
console.log(`Skipped ${skipped.length}: ${skipped.join(" | ") || "none"}`);
if (nomatch.length) console.log(`Name-mismatch ${nomatch.length}: ${nomatch.join(" | ")}`);
console.log(`\n📞 sales_customers WITH a phone now: ${total} of 117`);
