/**
 * Yuval Entrepreneurs LLP — finance file importer.
 *
 *   - SalesRegister yuval .xlsx                  → transactions (Sales) + customers
 *   - AmountPayable YUVAL ENT.xlsx               → AP carry-forward OB entries + vendors
 *   - AmountReceivable yuval ent AMT RECV .xlsx  → AR carry-forward OB entries + customers
 *   - yuval ent april.xls / yuval ent may.xls    → AU SFB bank_statements
 *
 * Run: node --env-file=.env.local scripts/import-yuval.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const DOCS = "/Users/sahilaggarwal/Documents/Finance - Bank Statements/Yuval";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: cmp } = await db.from("companies").select("id").eq("short_name", "Yuval Ent").single();
if (!cmp) { console.error("Yuval Enterprises company not found"); process.exit(1); }
const COMPANY_ID = cmp.id;
const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;
console.log(`Company (Yuval Ent): ${COMPANY_ID}`);

// ─── Helpers ────────────────────────────────────────────────────────────────

const inPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);

function toIso(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let y = m[3]; if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function parseRupees(s) {
  if (s === null || s === undefined || s === "" || s === "-") return 0;
  if (typeof s === "number") return Math.abs(s);
  const cleaned = String(s).replace(/[₹,\s]/g, "").replace(/^\((.+)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function inferFY(iso) {
  const y = parseInt(iso.slice(0, 4));
  const mo = parseInt(iso.slice(5, 7));
  return mo >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

function readXlsx(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });
}

const vendorCache = new Map();
const customerCache = new Map();

async function preloadParties() {
  const [{ data: v }, { data: c }] = await Promise.all([
    db.from("vendors").select("id, name").eq("company_id", COMPANY_ID),
    db.from("customers").select("id, name").eq("company_id", COMPANY_ID),
  ]);
  for (const r of v || []) vendorCache.set(r.name.toLowerCase().trim(), r.id);
  for (const r of c || []) customerCache.set(r.name.toLowerCase().trim(), r.id);
}

// Workaround for migration 008 not yet applied:
// the `customers.name` / `vendors.name` columns have a GLOBAL unique
// constraint, so if a party already exists under another company we
// suffix " (Yuval)" to keep the names distinct. After migration 008
// applies, retries can drop the suffix.
const NAME_SUFFIX = " (Yuval)";

async function tryInsertWithSuffix(table, name, extra) {
  const trimmed = name.trim();
  const candidates = [trimmed, trimmed + NAME_SUFFIX];
  for (const candidate of candidates) {
    const { data, error } = await db.from(table)
      .insert({ name: candidate, company_id: COMPANY_ID, ...extra })
      .select("id, name").single();
    if (!error) return data;
    // Unique violation? Check if a row with that exact name+company already exists.
    const { data: same } = await db.from(table)
      .select("id, name").eq("name", candidate).eq("company_id", COMPANY_ID).maybeSingle();
    if (same) return same;
    // Otherwise try the next candidate (suffixed)
  }
  throw new Error(`Could not create ${table} record for "${name}" after suffix retry`);
}

async function ensureVendor(name, extra = {}) {
  const key = name.toLowerCase().trim();
  if (vendorCache.has(key)) return vendorCache.get(key);
  const row = await tryInsertWithSuffix("vendors", name, extra);
  vendorCache.set(key, row.id);
  // Also cache the actual saved name (with suffix) so callers using the saved name find it
  vendorCache.set(row.name.toLowerCase().trim(), row.id);
  return row.id;
}

async function ensureCustomer(name, extra = {}) {
  const key = name.toLowerCase().trim();
  if (customerCache.has(key)) return customerCache.get(key);
  const row = await tryInsertWithSuffix("customers", name, extra);
  customerCache.set(key, row.id);
  customerCache.set(row.name.toLowerCase().trim(), row.id);
  return row.id;
}

/** Resolve the actual ledger_name that was saved (may include suffix). */
async function resolvedName(table, name) {
  const trimmed = name.trim();
  const { data } = await db.from(table)
    .select("name").eq("company_id", COMPANY_ID)
    .or(`name.eq.${trimmed},name.eq.${trimmed + NAME_SUFFIX}`)
    .maybeSingle();
  return data?.name || trimmed;
}

async function createImport(file_name, file_type, module) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type, module,
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: "2026-27",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function finishImport(import_id, rows_imported, error_log = null) {
  await db.from("file_imports").update({
    status: error_log ? "failed" : "completed",
    rows_imported, error_log,
    completed_at: new Date().toISOString(),
  }).eq("id", import_id);
}

async function insertBatched(table, rows, size = 500) {
  if (!rows.length) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += size) {
    const batch = rows.slice(i, i + size);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += batch.length;
  }
  return inserted;
}

// ─── 1. SALES REGISTER ──────────────────────────────────────────────────────

const salesByCustomer = new Map(); // customer name → net DR amount (for reconciliation)

async function importSales() {
  const fname = "SalesRegister yuval .xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);
  // Header at row 5; data row 6+.
  const import_id = await createImport(fname, "xlsx", "transactions");
  const txns = [];
  let newCust = 0;
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 6) continue;
    const [date, vch, account, gstin, type, total] = row;
    if (!account) continue;
    const name = String(account).trim();
    if (/^(grand\s+)?total/i.test(name)) continue;
    const iso = toIso(date);
    if (!iso) continue;
    const amt = parseRupees(total);
    if (amt === 0) continue;
    const before = customerCache.size;
    await ensureCustomer(name, gstin ? { gstin: String(gstin).trim() } : {});
    if (customerCache.size > before) newCust++;
    const savedName = await resolvedName("customers", name);
    txns.push({
      transaction_date: iso,
      voucher_number: vch ? String(vch).trim() : null,
      voucher_type: "Sales",
      ledger_name: savedName,
      amount: amt,
      dr_cr: "DR",
      narration: type ? `Sale ${type}` : "Sale",
      financial_year: inferFY(iso),
      import_id,
      company_id: COMPANY_ID,
    });
    salesByCustomer.set(savedName, (salesByCustomer.get(savedName) || 0) + amt);
  }
  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Sales: ${ok} invoices, ${newCust} new customers`);
}

// ─── 2. AP carry-forward (Apr-1 OB entries) ─────────────────────────────────

async function importPayables() {
  const fname = "AmountPayable YUVAL ENT.xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);
  // Header at row 5; data from row 6.
  const import_id = await createImport(fname, "xlsx", "payables");
  const txns = [];
  let newVen = 0;
  for (let i = 6; i < matrix.length; i++) {
    const [name, bal] = matrix[i] || [];
    if (!name) continue;
    const n = String(name).trim();
    if (/^(grand\s+)?total/i.test(n)) continue;
    const amt = parseRupees(bal);
    if (amt === 0) continue;
    const before = vendorCache.size;
    await ensureVendor(n);
    if (vendorCache.size > before) newVen++;
    const savedName = await resolvedName("vendors", n);
    txns.push({
      transaction_date: "2026-04-01",
      voucher_number: `OB-AP-${n.slice(0, 8).toUpperCase().replace(/\s/g, "")}`,
      voucher_type: "OpeningBalance",
      ledger_name: savedName,
      amount: amt,
      dr_cr: "CR",
      narration: "Carry-forward AP from prior FY (per Busy snapshot 19-May-2026)",
      financial_year: "2026-27",
      import_id,
      company_id: COMPANY_ID,
    });
  }
  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ AP: ${ok} OB rows, ${newVen} new vendors`);
}

// ─── 3. AR carry-forward (Apr-1 OB entries netted vs Sales register) ────────

async function importReceivables() {
  const fname = "AmountReceivable yuval ent AMT RECV .xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);
  const import_id = await createImport(fname, "xlsx", "receivables");
  const txns = [];
  let newCust = 0;
  for (let i = 6; i < matrix.length; i++) {
    const [name, bal] = matrix[i] || [];
    if (!name) continue;
    const n = String(name).trim();
    if (/^(grand\s+)?total/i.test(n)) continue;
    const snapshot = parseRupees(bal);
    if (snapshot === 0) continue;
    const before = customerCache.size;
    await ensureCustomer(n);
    if (customerCache.size > before) newCust++;
    const savedName = await resolvedName("customers", n);
    // Carry-forward = snapshot − Apr-May sales DR. May be negative (= advance).
    const salesDr = salesByCustomer.get(savedName) || 0;
    const gap = snapshot - salesDr;
    if (Math.abs(gap) < 1) continue;
    txns.push({
      transaction_date: "2026-04-01",
      voucher_number: `OB-AR-${n.slice(0, 8).toUpperCase().replace(/\s/g, "")}`,
      voucher_type: "OpeningBalance",
      ledger_name: savedName,
      amount: Math.abs(gap),
      dr_cr: gap > 0 ? "DR" : "CR",
      narration: "Carry-forward AR from prior FY (per Busy snapshot 19-May-2026)",
      financial_year: "2026-27",
      import_id,
      company_id: COMPANY_ID,
    });
  }
  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ AR: ${ok} OB rows (reconciled to sales), ${newCust} new customers`);
}

// ─── 4. AU SFB bank statements ──────────────────────────────────────────────
//
// Layout (per inspected files):
//   Row 0-6: metadata (account no, opening/closing balance, dates)
//   Row 7:   header — Trans Date | Value Date | Description | Chq/Ref No | Debit | Credit | Balance
//   Row 8+:  transactions (debit OR credit per row; the other column shows '-')
//   Final:   may contain a Total row

async function importAuStatement({ fname, isFirstFile }) {
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);

  // Pull metadata from header rows
  const acctMatch = (matrix[2]?.find?.((c) => c && /\d{10,}/.test(String(c))) || "").toString();
  const accountNumber = (acctMatch.match(/(\d{10,})/) || [])[1] || "2502244694715651";
  const openingBalance = parseRupees(matrix[3]?.find?.((c) => c && /^[\d,.]+$/.test(String(c).trim())));
  const closingBalance = parseRupees(matrix[4]?.find?.((c) => c && /^[\d,.]+$/.test(String(c).trim())));

  // Find header row
  let headerRow = -1;
  for (let i = 0; i < Math.min(15, matrix.length); i++) {
    const r = matrix[i] || [];
    if (r.some((c) => /trans\s*date|transaction\s*date/i.test(String(c || "")))) {
      headerRow = i; break;
    }
  }
  if (headerRow < 0) throw new Error(`Header row not found in ${fname}`);

  const rows = [];
  for (let i = headerRow + 1; i < matrix.length; i++) {
    const r = matrix[i] || [];
    if (!r[0]) continue;
    // Skip total / footer
    if (/total/i.test(String(r[0] || "")) || /total/i.test(String(r[3] || ""))) continue;
    const iso = toIso(r[0]);
    if (!iso) continue;
    const debit = parseRupees(r[4]);
    const credit = parseRupees(r[5]);
    if (debit === 0 && credit === 0) continue;
    rows.push({
      date: iso,
      value_date: toIso(r[1]) || iso,
      description: String(r[2] || "").replace(/\s+/g, " ").trim() || "(no description)",
      reference: r[3] ? String(r[3]).trim() : null,
      debit, credit,
      balance: parseRupees(r[6]) * (String(r[6] ?? "").trim().startsWith("-") ? -1 : 1),
    });
  }

  if (rows.length === 0) {
    console.log("  ⚠ No transactions parsed");
    return;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));

  const import_id = await createImport(fname, "xlsx", "bank_statement");

  // Find or create AU SFB account
  const { data: existing } = await db.from("bank_accounts")
    .select("id, period_start, period_end")
    .eq("account_number", accountNumber)
    .eq("company_id", COMPANY_ID).maybeSingle();

  let acctId;
  if (existing) {
    acctId = existing.id;
    // Extend period + update closing balance
    const newStart = !existing.period_start || rows[0].date < existing.period_start ? rows[0].date : existing.period_start;
    const newEnd = !existing.period_end || rows[rows.length-1].date > existing.period_end ? rows[rows.length-1].date : existing.period_end;
    await db.from("bank_accounts").update({
      period_start: newStart,
      period_end: newEnd,
      closing_balance: inPaisa(closingBalance || rows[rows.length-1].balance),
    }).eq("id", acctId);
    console.log(`  ✓ Updated existing account ${accountNumber}`);
  } else {
    const { data: created, error } = await db.from("bank_accounts").insert({
      bank_name: "AU Small Finance Bank",
      account_number: accountNumber,
      account_number_last4: accountNumber.slice(-4),
      account_type: "current",
      account_holder_name: "YUVAL ENTREPRENEURS LLP",
      opening_balance: inPaisa(openingBalance || rows[0].balance - rows[0].credit + rows[0].debit),
      closing_balance: inPaisa(closingBalance || rows[rows.length-1].balance),
      period_start: rows[0].date,
      period_end: rows[rows.length-1].date,
      statement_date: rows[rows.length-1].date,
      is_primary: isFirstFile,
      import_id,
      company_id: COMPANY_ID,
    }).select("id").single();
    if (error) throw new Error(`bank_accounts: ${error.message}`);
    acctId = created.id;
    console.log(`  ✓ Created account AU SFB ···${accountNumber.slice(-4)}`);
  }

  const stmtRows = rows.map((t) => ({
    bank_account_id: acctId,
    transaction_date: t.date,
    value_date: t.value_date,
    description: t.description,
    reference: t.reference,
    debit: inPaisa(t.debit),
    credit: inPaisa(t.credit),
    balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", stmtRows);
  await finishImport(import_id, ok);
  console.log(`✓ ${fname}: ${ok} bank transactions`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

await preloadParties();

await importSales();
await importPayables();
await importReceivables();
await importAuStatement({ fname: "yuval ent april.xls", isFirstFile: true });
await importAuStatement({ fname: "yuval ent may.xls",   isFirstFile: false });

// Summary
const [{ count: tCount }, { count: bCount }, { count: vCount }, { count: cCount }, { count: fCount }] = await Promise.all([
  db.from("transactions").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("bank_accounts").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("vendors").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("customers").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("file_imports").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
]);
console.log("\n=== Yuval Enterprises totals ===");
console.log(`  transactions:   ${tCount}`);
console.log(`  bank_accounts:  ${bCount}`);
console.log(`  vendors:        ${vCount}`);
console.log(`  customers:      ${cCount}`);
console.log(`  file_imports:   ${fCount}`);
