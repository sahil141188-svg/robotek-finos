/**
 * Replace OCR-derived Robotek HDFC ···0589 data with clean XLS data.
 *
 * Inputs (HDFC NetBanking XLS export):
 *   April 1-30: Acct_Statement_XXXXXXXX0589_27052026.xls
 *   May 1-27 : Acct_Statement_XXXXXXXX0589_27052026 (1).xls
 *
 * Strategy:
 *   1. Locate existing HDFC account (Robotek)
 *   2. Delete ALL existing bank_statements for it
 *      (the OCR data had ~₹56L reconciliation gap — replace wholesale)
 *   3. Parse + insert April + May rows
 *   4. Update account opening_balance (April first row's pre-balance)
 *      and closing_balance (May last row's post-balance)
 *   5. Reconcile
 *
 * Run: node --env-file=.env.local scripts/update-robotek-hdfc.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const APRIL = "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/2B1AC573-9E2B-4D49-94CA-35A5CBB32023/Acct_Statement_XXXXXXXX0589_27052026.xls";
const MAY   = "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/061529E2-F029-47B2-BA11-755F59D5C336/Acct_Statement_XXXXXXXX0589_27052026 (1).xls";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: cmp } = await db.from("companies").select("id").order("sort_order").limit(1).single();
const COMPANY_ID = cmp.id;
const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;
console.log(`Company (Robotek): ${COMPANY_ID}`);

const inPaisa = (n) => Math.round(Number(n || 0) * 100);

function parseDateDDMMYY(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{2})\/(\d{2})\/(\d{2,4})/);
  if (!m) return null;
  let y = m[3]; if (y.length === 2) y = "20" + y;
  return `${y}-${m[2]}-${m[1]}`;
}

function parseRupees(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/,/g, "").trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function parseHdfcXls(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer" });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });
  // Header at row 16 (Date | Narration | Chq/Ref | Value Dt | Withdrawal | Deposit | Closing Balance)
  // Data from row 18 (row 17 is asterisks)
  const rows = [];
  for (let i = 18; i < m.length; i++) {
    const r = m[i];
    if (!r || !r[0]) continue;
    const date = parseDateDDMMYY(r[0]);
    if (!date) continue;
    // Description can wrap across multiple cells/rows in some exports;
    // but in this format each row is one transaction.
    const desc = String(r[1] || "").replace(/\s+/g, " ").trim();
    const ref  = r[2] ? String(r[2]).trim() : null;
    const valDate = parseDateDDMMYY(r[3]) || date;
    const debit  = parseRupees(r[4]);  // Withdrawal
    const credit = parseRupees(r[5]);  // Deposit
    const balance = parseRupees(r[6]); // Closing Balance (can be negative for OD)
    if (debit === 0 && credit === 0) continue;
    rows.push({ date, value_date: valDate, description: desc || "(no description)", reference: ref, debit, credit, balance });
  }
  return rows;
}

async function createImport(file_name) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type: "xlsx", module: "bank_statement",
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: "2026-27",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}
async function finishImport(id, n) {
  await db.from("file_imports").update({
    status: "completed", rows_imported: n,
    completed_at: new Date().toISOString(),
  }).eq("id", id);
}
async function insertBatched(table, rows, size = 500) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table}: ${error.message}`);
    n += Math.min(size, rows.length - i);
  }
  return n;
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log("\n▶ Parsing files…");
const aprRows = parseHdfcXls(APRIL);
const mayRows = parseHdfcXls(MAY);
console.log(`  April: ${aprRows.length} rows`);
console.log(`  May  : ${mayRows.length} rows`);

const allRows = [...aprRows, ...mayRows];
allRows.sort((a, b) => a.date.localeCompare(b.date));

// Opening balance = balance before the FIRST transaction
const first = allRows[0];
const openingBalance = first.balance - first.credit + first.debit;
// Closing balance = LAST row's closing balance
const closingBalance = allRows[allRows.length - 1].balance;

console.log(`\n▶ Opening balance (before ${first.date}): ₹${openingBalance.toLocaleString("en-IN")}`);
console.log(`  Closing balance (${allRows[allRows.length - 1].date}): ₹${closingBalance.toLocaleString("en-IN")}`);

// Find HDFC account
const { data: acct } = await db.from("bank_accounts")
  .select("id, account_number_last4")
  .eq("bank_name", "HDFC Bank")
  .eq("company_id", COMPANY_ID)
  .maybeSingle();
if (!acct) { console.error("HDFC account not found"); process.exit(1); }

// Delete ALL existing HDFC bank_statements
const { count: delCount } = await db
  .from("bank_statements")
  .delete({ count: "exact" })
  .eq("bank_account_id", acct.id);
console.log(`\n▶ Deleted ${delCount} OCR-derived rows`);

// Insert new
const import_id_apr = await createImport("HDFC_Robotek_April_clean.xls");
const import_id_may = await createImport("HDFC_Robotek_May_clean.xls");

const aprPayload = aprRows.map((t) => ({
  bank_account_id: acct.id,
  transaction_date: t.date, value_date: t.value_date,
  description: t.description, reference: t.reference,
  debit: inPaisa(t.debit), credit: inPaisa(t.credit), balance: inPaisa(t.balance),
  import_id: import_id_apr,
}));
const mayPayload = mayRows.map((t) => ({
  bank_account_id: acct.id,
  transaction_date: t.date, value_date: t.value_date,
  description: t.description, reference: t.reference,
  debit: inPaisa(t.debit), credit: inPaisa(t.credit), balance: inPaisa(t.balance),
  import_id: import_id_may,
}));

const aprOk = await insertBatched("bank_statements", aprPayload);
const mayOk = await insertBatched("bank_statements", mayPayload);
await finishImport(import_id_apr, aprOk);
await finishImport(import_id_may, mayOk);
console.log(`\n▶ Inserted April: ${aprOk} · May: ${mayOk}`);

// Update account
await db.from("bank_accounts").update({
  opening_balance: inPaisa(openingBalance),
  closing_balance: inPaisa(closingBalance),
  period_start: allRows[0].date,
  period_end:   allRows[allRows.length - 1].date,
  statement_date: allRows[allRows.length - 1].date,
}).eq("id", acct.id);

// Reconcile
const { data: a } = await db.from("bank_accounts").select("opening_balance, closing_balance, period_start, period_end").eq("id", acct.id).single();
const { data: stmts } = await db.from("bank_statements").select("debit, credit").eq("bank_account_id", acct.id);
let d = 0, c = 0;
for (const r of stmts) { d += Number(r.debit); c += Number(r.credit); }
const swing = (Number(a.closing_balance) - Number(a.opening_balance)) / 100;
const net = (c - d) / 100;
const diff = Math.abs(swing - net);
console.log(`\n=== HDFC reconciliation ===`);
console.log(`Period: ${a.period_start} → ${a.period_end}`);
console.log(`Opening: ₹${(Number(a.opening_balance)/100).toLocaleString("en-IN")}  Closing: ₹${(Number(a.closing_balance)/100).toLocaleString("en-IN")}`);
console.log(`Debits:  ₹${(d/100).toLocaleString("en-IN")}  Credits: ₹${(c/100).toLocaleString("en-IN")}`);
console.log(`Swing:   ₹${swing.toLocaleString("en-IN")}  Net Cr-Dr: ₹${net.toLocaleString("en-IN")}`);
console.log(`Diff: ₹${diff.toFixed(2)} ${diff < 5 ? "✓" : "⚠"}`);
