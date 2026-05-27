/**
 * Update Robotek IDBI + Kotak May statements (1-27 May 2026).
 *
 * Strategy:
 *   1. Locate existing IDBI and Kotak bank_accounts for Robotek
 *   2. Delete all bank_statements with transaction_date >= 2026-05-01
 *      on those accounts (clears the partial May 1-20 we had before)
 *   3. Parse the new files and insert every row
 *   4. Update account closing_balance and period_end
 *
 * Inputs (WhatsApp-shared paths):
 *   /tmp/.../ROBOTEK IDBI.xls   (IDBI XLS, 126 rows)
 *   /tmp/.../ROBOTEK KOTAK.csv  (Kotak CSV, 42 rows)
 *
 * Run: node --env-file=.env.local scripts/update-robotek-bank-may.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const IDBI_XLS   = "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/0E3A6DD6-5C6F-4E44-9F5E-CF42EF78560B/ROBOTEK IDBI.xls";
const KOTAK_CSV  = "/Users/sahilaggarwal/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/03C25467-CBF5-44D5-982D-EACE9B54B0DD/ROBOTEK KOTAK.csv";

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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
  // YYYY-MM-DD or YYYY-MM-DD HH:MM:SS (xlsx auto-parsed datetime cells)
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // DD/MM/YYYY or DD-MM-YYYY (optionally followed by HH:MM:SS)
  const dmy = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
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
    status: "completed", rows_imported,
    completed_at: new Date().toISOString(),
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

// ─── IDBI XLS ───────────────────────────────────────────────────────────────

async function updateIdbi() {
  const fname = "ROBOTEK IDBI.xls (May 2026 update)";
  console.log(`\n▶ ${fname}`);
  const wb = XLSX.read(readFileSync(IDBI_XLS), { type: "buffer" });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });

  // Header row 5: [_, _, Srl, Txn Date, Value Date, Description, Cheque No, CR/DR, CCY, Amount, Balance]
  // File is reverse-chronological (srl 1 = most recent). We keep the srl
  // so we can sort properly even when many txns share a date.
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
      debit:  crDr.startsWith("dr") ? amt : 0,
      credit: crDr.startsWith("cr") ? amt : 0,
      balance: bal,
    });
  }
  // Sort chronologically: highest srl = oldest, srl 1 = newest. So ascending by srl DESC.
  rows.sort((a, b) => b.srl - a.srl);
  if (rows.length === 0) { console.log("  ⚠ No transactions parsed"); return; }

  // Find existing IDBI account
  const { data: acct } = await db.from("bank_accounts")
    .select("id, period_start").eq("bank_name", "IDBI Bank").eq("company_id", COMPANY_ID).maybeSingle();
  if (!acct) { console.log("  ⚠ IDBI account not found"); return; }

  // Delete existing May data
  const minNewDate = rows[0].date;
  const { count: delCount } = await db
    .from("bank_statements")
    .delete({ count: "exact" })
    .eq("bank_account_id", acct.id)
    .gte("transaction_date", minNewDate);
  console.log(`  Deleted ${delCount || 0} existing May rows`);

  // Insert new
  const import_id = await createImport(fname, "xlsx");
  const stmts = rows.map((t) => ({
    bank_account_id: acct.id,
    transaction_date: t.date, value_date: t.value_date,
    description: t.description, reference: t.reference,
    debit: inPaisa(t.debit), credit: inPaisa(t.credit), balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", stmts);
  await finishImport(import_id, ok);

  // Update period_end and closing_balance
  const newCloseBal = rows[rows.length - 1].balance;
  const newPeriodEnd = rows[rows.length - 1].date;
  await db.from("bank_accounts").update({
    period_end:      newPeriodEnd,
    statement_date:  newPeriodEnd,
    closing_balance: inPaisa(newCloseBal),
  }).eq("id", acct.id);

  console.log(`  ✓ Inserted ${ok} IDBI rows · period now ${acct.period_start} → ${newPeriodEnd} · closing ₹${newCloseBal.toLocaleString("en-IN")}`);
}

// ─── KOTAK CSV ──────────────────────────────────────────────────────────────

async function updateKotak() {
  const fname = "ROBOTEK KOTAK.csv (May 2026 update)";
  console.log(`\n▶ ${fname}`);
  const text = readFileSync(KOTAK_CSV, "utf8");

  // CSV is messy — headers on row 11 ("Sl. No.,Transaction Date,..."). Find it.
  const lines = text.split(/\r?\n/);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^Sl\.?\s*No\.?,Transaction\s*Date/i.test(lines[i])) { headerIdx = i; break; }
  }
  if (headerIdx < 0) { console.log("  ⚠ Header row not found"); return; }

  // Parse from header onwards using xlsx CSV parser
  const csvBody = lines.slice(headerIdx).join("\n");
  const wb = XLSX.read(csvBody, { type: "string" });
  const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

  const rows = [];
  for (const r of data) {
    const dateStr = r["Transaction Date"];
    const txnDate = parseISODate(dateStr);
    if (!txnDate) continue;
    const valDate = parseISODate(r["Value Date"]) || txnDate;
    const debit  = parseRupees(r["Debit"]);
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
  if (rows.length === 0) { console.log("  ⚠ No transactions parsed"); return; }

  const { data: acct } = await db.from("bank_accounts")
    .select("id, period_start").eq("bank_name", "Kotak Mahindra Bank").eq("company_id", COMPANY_ID).maybeSingle();
  if (!acct) { console.log("  ⚠ Kotak account not found"); return; }

  const minNewDate = rows[0].date;
  const { count: delCount } = await db
    .from("bank_statements")
    .delete({ count: "exact" })
    .eq("bank_account_id", acct.id)
    .gte("transaction_date", minNewDate);
  console.log(`  Deleted ${delCount || 0} existing May rows`);

  const import_id = await createImport(fname, "csv");
  const stmts = rows.map((t) => ({
    bank_account_id: acct.id,
    transaction_date: t.date, value_date: t.value_date,
    description: t.description, reference: t.reference,
    debit: inPaisa(t.debit), credit: inPaisa(t.credit), balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", stmts);
  await finishImport(import_id, ok);

  const newCloseBal = rows[rows.length - 1].balance;
  const newPeriodEnd = rows[rows.length - 1].date;
  await db.from("bank_accounts").update({
    period_end:      newPeriodEnd,
    statement_date:  newPeriodEnd,
    closing_balance: inPaisa(newCloseBal),
  }).eq("id", acct.id);

  console.log(`  ✓ Inserted ${ok} Kotak rows · period now ${acct.period_start} → ${newPeriodEnd} · closing ₹${newCloseBal.toLocaleString("en-IN")}`);
}

await updateIdbi();
await updateKotak();

// Reconciliation check
console.log("\n=== Post-update reconciliation ===");
const { data: ba } = await db.from("bank_accounts")
  .select("id, bank_name, account_number_last4, opening_balance, closing_balance, period_start, period_end")
  .in("bank_name", ["IDBI Bank", "Kotak Mahindra Bank"]).eq("company_id", COMPANY_ID);

for (const a of ba) {
  const { data } = await db.from("bank_statements").select("debit, credit").eq("bank_account_id", a.id);
  let d = 0, c = 0;
  for (const r of data) { d += Number(r.debit); c += Number(r.credit); }
  const swing = (Number(a.closing_balance) - Number(a.opening_balance)) / 100;
  const net = (c - d) / 100;
  const diff = Math.abs(swing - net);
  console.log(`${a.bank_name} ···${a.account_number_last4} | ${a.period_start} → ${a.period_end}`);
  console.log(`  Opening: ₹${(Number(a.opening_balance)/100).toLocaleString("en-IN")}  Closing: ₹${(Number(a.closing_balance)/100).toLocaleString("en-IN")}`);
  console.log(`  Debits:  ₹${(d/100).toLocaleString("en-IN")}  Credits: ₹${(c/100).toLocaleString("en-IN")}`);
  console.log(`  Diff: ₹${diff.toFixed(2)} ${diff < 5 ? "✓" : "⚠"}`);
}
