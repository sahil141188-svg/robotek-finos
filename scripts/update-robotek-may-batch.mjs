/**
 * Update Robotek IDBI + HDFC + Kotak with the 5 statements uploaded to
 * Drive on 2026-05-29 / 2026-05-30. Processes oldest → newest so each
 * subsequent file replaces overlapping dates.
 *
 * Run: node --env-file=.env.local scripts/update-robotek-may-batch.mjs
 *
 * Files (in process order):
 *   1. KOTAK 21-28.csv       — Kotak account ···4008
 *   2. IDBI 26-28.xls        — IDBI account ···1811
 *   3. ROBOTEK HDFC 27-29.xls — HDFC account ···0589
 *   4. robotek idbi 28-30.xls — IDBI ···1811 (extends to 30 May)
 *   5. robotek hdfc 29-30.xls — HDFC ···0589 (extends to 30 May)
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { Buffer } from "buffer";
import { existsSync, readFileSync } from "fs";

const FILES = [
  { name: "KOTAK 21-28.csv",        bank: "Kotak Mahindra Bank", kind: "csv", path: "/tmp/robotek-may-update/KOTAK 21-28.csv" },
  { name: "IDBI 26-28.xls",         bank: "IDBI Bank",           kind: "xls", path: "/tmp/robotek-may-update/IDBI 26-28.xls" },
  { name: "ROBOTEK HDFC 27-29.xls", bank: "HDFC Bank",           kind: "hdfc-xls", path: "/tmp/robotek-may-update/ROBOTEK HDFC 27-29.xls" },
  { name: "robotek idbi 28-30.xls", bank: "IDBI Bank",           kind: "xls", path: "/tmp/robotek-may-update/robotek idbi 28-30.xls" },
  { name: "robotek hdfc 29-30.xls", bank: "HDFC Bank",           kind: "hdfc-xls", path: "/tmp/robotek-may-update/robotek hdfc 29-30.xls" },
];

for (const f of FILES) {
  if (!existsSync(f.path)) { console.error(`Missing file: ${f.path}`); process.exit(1); }
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: cmp } = await db.from("companies").select("id").eq("short_name", "Robotek").single();
const COMPANY_ID = cmp.id;
const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;
console.log(`Company (Robotek): ${COMPANY_ID}`);

// ── Helpers ──────────────────────────────────────────────────────────────────
const inPaisa = (n) => Math.round(Number(n || 0) * 100);

function parseRupees(s) {
  if (s === null || s === undefined || s === "" || s === "-") return 0;
  if (typeof s === "number") return Math.abs(s);
  const cleaned = String(s).replace(/[₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function parseISODate(s) {
  if (!s) return null;
  if (s instanceof Date) return s.toISOString().slice(0, 10);
  const str = String(s).trim();
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4}|\d{2})\b/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${yr}-${dmy[2]}-${dmy[1]}`;
  }
  return null;
}

async function createImport(file_name, file_type) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type, module: "bank_statement",
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: "2026-27",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishImport(id, rows_imported) {
  await db.from("file_imports").update({
    status: "completed", rows_imported, completed_at: new Date().toISOString(),
  }).eq("id", id);
}

async function insertBatched(table, rows, size = 500) {
  if (!rows.length) return 0;
  let n = 0;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    n += batch.length;
  }
  return n;
}

// ── Parsers ──────────────────────────────────────────────────────────────────

/** IDBI XLS — same format as the May import script: srl-sorted, columns
 *  Srl | Txn Date | Value Date | Description | Cheque No | CR/DR | CCY | Amount | Balance. */
function parseIdbiXls(filePath) {
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });
  const rows = [];
  for (let i = 6; i < m.length; i++) {
    const r = m[i];
    if (!r || !r[3]) continue;
    const txnDate = parseISODate(r[3]);
    const valDate = parseISODate(r[4]) || txnDate;
    if (!txnDate) continue;
    const crDr = String(r[7] || "").trim().toLowerCase();
    const amt = parseRupees(r[9]);
    const bal = parseRupees(r[10]);
    if (amt === 0) continue;
    rows.push({
      srl: Number(r[2]) || 0,
      date: txnDate, value_date: valDate,
      description: String(r[5] || "").trim() || "(no description)",
      reference: r[6] ? String(r[6]).trim() : null,
      debit: crDr.startsWith("dr") ? amt : 0,
      credit: crDr.startsWith("cr") ? amt : 0,
      balance: bal,
    });
  }
  rows.sort((a, b) => b.srl - a.srl); // file is reverse-chronological (srl 1 = newest)
  return rows;
}

/** HDFC XLS — proprietary HDFC format. Find the row whose first cell starts
 *  with "Date" then iterate till the "STATEMENT SUMMARY" footer. Columns:
 *  Date | Narration | Chq./Ref.No. | Value Dt | Withdrawal Amt. | Deposit Amt. | Closing Balance. */
function parseHdfcXls(filePath) {
  const wb = XLSX.read(readFileSync(filePath), { type: "buffer" });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });
  let headerIdx = -1;
  for (let i = 0; i < m.length; i++) {
    const c0 = String(m[i]?.[0] ?? "").trim().toLowerCase();
    if (c0 === "date") { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const rows = [];
  let currentDate = null;
  for (let i = headerIdx + 2; i < m.length; i++) { // skip header + the "***" divider row
    const r = m[i];
    if (!r) continue;
    const c0 = String(r[0] ?? "").trim();
    if (/^STATEMENT SUMMARY/i.test(c0) || /^\*{5,}/.test(c0)) break;
    // Some rows have date in col 0, some carry over from previous row
    const maybeDate = parseISODate(c0);
    if (maybeDate) currentDate = maybeDate;
    // Need: c0=date c1=narration c2=ref c3=value_dt c4=withdrawal c5=deposit c6=balance
    const narration = String(r[1] ?? "").trim();
    if (!currentDate && !narration) continue;
    const dr = parseRupees(r[4]);
    const cr = parseRupees(r[5]);
    const bal = parseRupees(r[6]);
    if (dr === 0 && cr === 0) continue;
    rows.push({
      date: currentDate,
      value_date: parseISODate(r[3]) || currentDate,
      description: narration || "(no description)",
      reference: r[2] ? String(r[2]).trim() : null,
      debit: dr, credit: cr, balance: bal,
    });
  }
  // HDFC is chronological top-to-bottom, but sort to be safe
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/** Kotak CSV — header row contains "Sl. No.,Transaction Date,...". */
function parseKotakCsv(filePath) {
  const text = readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Sl\.?\s*No\.?,Transaction\s*Date/i.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return [];
  const csvBody = lines.slice(headerIdx).join("\n");
  const wb = XLSX.read(csvBody, { type: "string" });
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
  const rows = [];
  for (const r of data) {
    const txnDate = parseISODate(r["Transaction Date"]);
    if (!txnDate) continue;
    const valDate = parseISODate(r["Value Date"]) || txnDate;
    const debit = parseRupees(r["Debit"]);
    const credit = parseRupees(r["Credit"]);
    if (debit === 0 && credit === 0) continue;
    const balStr = String(r["Balance"] ?? "");
    const balanceSign = balStr.trim().startsWith("-") ? -1 : 1;
    rows.push({
      date: txnDate, value_date: valDate,
      description: String(r["Description"] || "").trim() || "(no description)",
      reference: r["Chq / Ref No."] ? String(r["Chq / Ref No."]).trim() : null,
      debit, credit,
      balance: parseRupees(balStr) * balanceSign,
    });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

// ── Process a single file ───────────────────────────────────────────────────

async function processFile(f) {
  console.log(`\n▶ ${f.name}`);
  let rows;
  if (f.kind === "csv")      rows = parseKotakCsv(f.path);
  else if (f.kind === "hdfc-xls") rows = parseHdfcXls(f.path);
  else                            rows = parseIdbiXls(f.path);
  if (rows.length === 0) { console.log("  ⚠ No rows parsed"); return; }

  const minDate = rows[0].date;
  const maxDate = rows[rows.length - 1].date;
  console.log(`  Parsed ${rows.length} rows · ${minDate} → ${maxDate}`);

  // Find the bank account
  const { data: acct } = await db.from("bank_accounts")
    .select("id, bank_name, account_number_last4, period_start")
    .eq("bank_name", f.bank).eq("company_id", COMPANY_ID).maybeSingle();
  if (!acct) { console.log(`  ⚠ ${f.bank} account not found for Robotek`); return; }
  console.log(`  Target account: ${acct.bank_name} ···${acct.account_number_last4}`);

  // Delete any existing data on/after this file's earliest date.
  // (Earlier file in the same run inserted some — newer file replaces.)
  const { count: delCount } = await db
    .from("bank_statements")
    .delete({ count: "exact" })
    .eq("bank_account_id", acct.id)
    .gte("transaction_date", minDate);
  console.log(`  Deleted ${delCount || 0} existing rows >= ${minDate}`);

  // Insert new rows
  const import_id = await createImport(f.name, f.kind === "csv" ? "csv" : "xls");
  const stmts = rows.map((t) => ({
    bank_account_id: acct.id,
    transaction_date: t.date,
    value_date: t.value_date,
    description: t.description,
    reference: t.reference,
    debit: inPaisa(t.debit),
    credit: inPaisa(t.credit),
    balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", stmts);
  await finishImport(import_id, ok);

  // Update account closing_balance + period_end
  const closeBal = rows[rows.length - 1].balance;
  const periodEnd = rows[rows.length - 1].date;
  await db.from("bank_accounts").update({
    period_end: periodEnd,
    statement_date: periodEnd,
    closing_balance: inPaisa(closeBal),
  }).eq("id", acct.id);

  console.log(`  ✓ Inserted ${ok} rows · new closing ₹${closeBal.toLocaleString("en-IN")} on ${periodEnd}`);
}

// ── Run sequentially (order matters) ────────────────────────────────────────

for (const f of FILES) {
  try { await processFile(f); }
  catch (e) { console.error(`  ✗ Failed: ${e.message}`); }
}

// ── Reconciliation check ────────────────────────────────────────────────────

console.log("\n=== Post-update reconciliation ===");
const { data: ba } = await db.from("bank_accounts")
  .select("id, bank_name, account_number_last4, opening_balance, closing_balance, period_start, period_end")
  .in("bank_name", ["IDBI Bank", "HDFC Bank", "Kotak Mahindra Bank"])
  .eq("company_id", COMPANY_ID);

for (const a of ba) {
  const { data } = await db.from("bank_statements").select("debit, credit").eq("bank_account_id", a.id);
  let d = 0, c = 0;
  for (const r of data) { d += Number(r.debit); c += Number(r.credit); }
  const swing = (Number(a.closing_balance) - Number(a.opening_balance)) / 100;
  const net = (c - d) / 100;
  const diff = Math.abs(swing - net);
  const flag = diff < 5 ? "✓" : "⚠";
  console.log(`${flag} ${a.bank_name} ···${a.account_number_last4} | ${a.period_start} → ${a.period_end}`);
  console.log(`    Opening: ₹${(Number(a.opening_balance)/100).toLocaleString("en-IN")}  Closing: ₹${(Number(a.closing_balance)/100).toLocaleString("en-IN")}`);
  console.log(`    Debits:  ₹${(d/100).toLocaleString("en-IN")}  Credits: ₹${(c/100).toLocaleString("en-IN")}`);
  console.log(`    Diff: ₹${diff.toFixed(2)}`);
}
