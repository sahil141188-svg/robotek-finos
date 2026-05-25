/**
 * Muskan Towers Pvt Ltd — finance file importer.
 *
 *   - SalesRegister muskan .xlsx              → transactions (Sales) + customers
 *   - PurchaseRegister muskan.xlsx            → transactions (Purchase) + vendors
 *   - MUSKAN TOWER CURRENT ACCOUNT STATEMENT  → bank_accounts + bank_statements
 *   - MUSKAN TOWER PVT LTD OD STATEMENT       → bank_accounts + bank_statements
 *
 * Run: node --env-file=.env.local scripts/import-muskan.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const DOCS = "/Users/sahilaggarwal/Documents/Finance - Bank Statements/Muskan";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// ─── Resolve Muskan company + uploader ──────────────────────────────────────

const { data: cmp } = await db.from("companies").select("id").eq("short_name", "Muskan").single();
if (!cmp) { console.error("Muskan company not found"); process.exit(1); }
const COMPANY_ID = cmp.id;
const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;
console.log(`Company (Muskan): ${COMPANY_ID}  Uploader: ${UPLOADER}`);

// ─── Helpers ────────────────────────────────────────────────────────────────

const inPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);

function toIso(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let y = m[3];
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

function parseRupees(s) {
  if (s === null || s === undefined || s === "") return 0;
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
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false });
}

// ─── DB helpers ─────────────────────────────────────────────────────────────

const vendorCache = new Map();
const customerCache = new Map();

async function preloadParties() {
  const [{ data: v }, { data: c }] = await Promise.all([
    db.from("vendors").select("id, name").eq("company_id", COMPANY_ID),
    db.from("customers").select("id, name").eq("company_id", COMPANY_ID),
  ]);
  for (const r of v || []) vendorCache.set(r.name.toLowerCase().trim(), r.id);
  for (const r of c || []) customerCache.set(r.name.toLowerCase().trim(), r.id);
  console.log(`Loaded ${vendorCache.size} vendors, ${customerCache.size} customers from DB`);
}

async function ensureVendor(name, extra = {}) {
  const key = name.toLowerCase().trim();
  if (vendorCache.has(key)) return vendorCache.get(key);
  const { data, error } = await db.from("vendors").insert({ name: name.trim(), company_id: COMPANY_ID, ...extra }).select("id").single();
  if (error) {
    const { data: existing } = await db.from("vendors").select("id").eq("name", name.trim()).eq("company_id", COMPANY_ID).maybeSingle();
    if (existing) { vendorCache.set(key, existing.id); return existing.id; }
    throw new Error(`vendor insert "${name}": ${error.message}`);
  }
  vendorCache.set(key, data.id);
  return data.id;
}

async function ensureCustomer(name, extra = {}) {
  const key = name.toLowerCase().trim();
  if (customerCache.has(key)) return customerCache.get(key);
  const { data, error } = await db.from("customers").insert({ name: name.trim(), company_id: COMPANY_ID, ...extra }).select("id").single();
  if (error) {
    const { data: existing } = await db.from("customers").select("id").eq("name", name.trim()).eq("company_id", COMPANY_ID).maybeSingle();
    if (existing) { customerCache.set(key, existing.id); return existing.id; }
    throw new Error(`customer insert "${name}": ${error.message}`);
  }
  customerCache.set(key, data.id);
  return data.id;
}

async function createImport(file_name, file_type, module) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type, module,
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: "2026-27",
  }).select("id").single();
  if (error) throw new Error(`file_imports: ${error.message}`);
  return data.id;
}

async function finishImport(import_id, rows_imported, rows_failed = 0, error_log = null) {
  await db.from("file_imports").update({
    status: rows_failed > 0 && rows_imported === 0 ? "failed" : "completed",
    rows_imported, rows_failed, error_log,
    completed_at: new Date().toISOString(),
  }).eq("id", import_id);
}

async function insertBatched(table, rows, batchSize = 500) {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`${table}: ${error.message}`);
    inserted += batch.length;
  }
  return inserted;
}

// ─── 1. SALES REGISTER ──────────────────────────────────────────────────────

async function importSales() {
  const fname = "SalesRegister muskan .xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);
  // Header at row 4. Data from row 5.
  const import_id = await createImport(fname, "xlsx", "transactions");

  const txns = [];
  const customerSet = new Map();
  for (let i = 5; i < matrix.length; i++) {
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
    if (gstin && !customerSet.has(name)) customerSet.set(name, String(gstin).trim() || null);
    else if (!customerSet.has(name)) customerSet.set(name, null);
    txns.push({
      transaction_date: iso,
      voucher_number: vch ? String(vch).trim() : null,
      voucher_type: "Sales",
      ledger_name: name,
      amount: amt,
      dr_cr: "DR",
      narration: type ? `Sale ${type}` : "Sale",
      financial_year: inferFY(iso),
      import_id,
      company_id: COMPANY_ID,
    });
  }

  let custCreated = 0;
  for (const [name, g] of customerSet) {
    const before = customerCache.size;
    await ensureCustomer(name, g ? { gstin: g } : {});
    if (customerCache.size > before) custCreated++;
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Sales: ${ok} txns, ${custCreated} new customers`);
}

// ─── 2. PURCHASE REGISTER ───────────────────────────────────────────────────

async function importPurchases() {
  const fname = "PurchaseRegister muskan.xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);
  const import_id = await createImport(fname, "xlsx", "transactions");

  const txns = [];
  const vendorSet = new Map();
  for (let i = 5; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 6) continue;
    const [date, vch, account, gstin, type, total] = row;
    if (!account) continue;
    const name = String(account).trim();
    if (/^(grand\s+)?total/i.test(name)) continue;
    // Skip cancelled vouchers (Busy marks them "(C A N C E L L E D)")
    if (/cancelled|c\s+a\s+n\s+c\s+e\s+l/i.test(name) && parseRupees(total) === 0) continue;
    const iso = toIso(date);
    if (!iso) continue;
    const amt = parseRupees(total);
    if (amt === 0) continue;
    if (gstin && !vendorSet.has(name)) vendorSet.set(name, String(gstin).trim() || null);
    else if (!vendorSet.has(name)) vendorSet.set(name, null);
    txns.push({
      transaction_date: iso,
      voucher_number: vch ? String(vch).trim() : null,
      voucher_type: "Purchase",
      ledger_name: name,
      amount: amt,
      dr_cr: "CR",
      narration: type ? `Purchase ${type}` : "Purchase",
      financial_year: inferFY(iso),
      import_id,
      company_id: COMPANY_ID,
    });
  }

  let venCreated = 0;
  for (const [name, g] of vendorSet) {
    const before = vendorCache.size;
    await ensureVendor(name, g ? { gstin: g } : {});
    if (vendorCache.size > before) venCreated++;
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Purchases: ${ok} txns, ${venCreated} new vendors`);
}

// ─── 3. BANK STATEMENT (SIB xls) ────────────────────────────────────────────
//
// Layout (10 columns):
//   0: SlNo
//   1: Transaction Date (DD-MM-YYYY)
//   2: Value Date
//   3: Particulars
//   4: (blank)
//   5: Cheque Number
//   6: Withdrawals (DEBIT)
//   7: (blank)
//   8: Deposits (CREDIT)
//   9: Balance Amount
//
// Account number / bank name come from the filename, since the .xls
// doesn't include them in the sheet body.

async function importSibStatement({ fname, accountType, accountSuffix, isPrimary }) {
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`);

  const rows = [];
  for (let i = 1; i < matrix.length; i++) {
    const r = matrix[i];
    if (!r || r.length < 10) continue;
    if (!r[1]) continue; // no date → footer or blank
    const iso = toIso(r[1]);
    if (!iso) continue;
    const withdrawal = parseRupees(r[6]);
    const deposit    = parseRupees(r[8]);
    if (withdrawal === 0 && deposit === 0) continue;
    const balanceRaw = String(r[9] ?? "");
    const balance = parseRupees(balanceRaw) * (balanceRaw.trim().startsWith("-") ? -1 : 1);
    rows.push({
      date: iso,
      value_date: toIso(r[2]) || iso,
      description: String(r[3] || "").replace(/\s+/g, " ").trim() || "(no description)",
      reference: r[5] ? String(r[5]).trim() : null,
      debit: withdrawal,
      credit: deposit,
      balance,
    });
  }

  if (rows.length === 0) {
    console.log("  ⚠ No transactions parsed");
    return;
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  const openingBalance = rows[0].balance - rows[0].credit + rows[0].debit;
  const closingBalance = rows[rows.length - 1].balance;

  const import_id = await createImport(fname, "xlsx", "bank_statement");

  const accountNumber = `MUSKAN-${accountType.toUpperCase()}-${accountSuffix}`;
  const { data: existing } = await db.from("bank_accounts")
    .select("id").eq("account_number", accountNumber).eq("company_id", COMPANY_ID).maybeSingle();
  let acctId;
  if (existing) {
    acctId = existing.id;
    console.log(`  ✓ Re-using existing account ${accountNumber}`);
  } else {
    const { data: created, error } = await db.from("bank_accounts").insert({
      bank_name: "South Indian Bank",
      account_number: accountNumber,
      account_number_last4: accountSuffix.padStart(4, "0"),
      account_type: accountType,
      account_holder_name: "MUSKAN TOWERS PVT LTD",
      branch: null,
      opening_balance: inPaisa(openingBalance),
      closing_balance: inPaisa(closingBalance),
      period_start: rows[0].date,
      period_end: rows[rows.length - 1].date,
      statement_date: rows[rows.length - 1].date,
      is_primary: isPrimary,
      import_id,
      company_id: COMPANY_ID,
    }).select("id").single();
    if (error) throw new Error(`bank_accounts: ${error.message}`);
    acctId = created.id;
    console.log(`  ✓ Created account ${accountNumber}`);
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
await importPurchases();
await importSibStatement({
  fname: "MUSKAN  TOWER PVT LTD OD STATEMENT.xls",
  accountType: "od",
  accountSuffix: "927",
  isPrimary: false,
});
await importSibStatement({
  fname: "MUSKAN TOWER CURRENT ACCOUNT STATEMENT.xls",
  accountType: "current",
  accountSuffix: "142",
  isPrimary: true,
});

// Final summary
const [{ count: tCount }, { count: bCount }, { count: bsCount }, { count: vCount }, { count: cCount }, { count: fCount }] = await Promise.all([
  db.from("transactions").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("bank_accounts").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("bank_statements").select("*", { count: "exact", head: true }),
  db.from("vendors").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("customers").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
  db.from("file_imports").select("*", { count: "exact", head: true }).eq("company_id", COMPANY_ID),
]);
console.log("\n=== Muskan totals ===");
console.log(`  transactions:    ${tCount}`);
console.log(`  bank_accounts:   ${bCount}`);
console.log(`  bank_statements: ${bsCount} (across all companies)`);
console.log(`  vendors:         ${vCount}`);
console.log(`  customers:       ${cCount}`);
console.log(`  file_imports:    ${fCount}`);
