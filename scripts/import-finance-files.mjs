/**
 * One-shot importer for Robotek FinOS — pulls in all April-May 2026 source files.
 *
 *   - DAY BOOK xlsx           → public.transactions
 *   - SALE REGISTER xlsx      → public.transactions (Sales) + public.customers
 *   - PURCHASE REGISTER xlsx  → public.transactions (Purchase) + public.vendors
 *   - Payable balance xlsx    → public.vendors (+ opening-balance transaction)
 *   - Receivable balance xlsx → public.customers (+ opening-balance transaction)
 *   - IDBI APRIL/MAY pdfs     → public.bank_accounts + public.bank_statements
 *   - HDFC pdf (scanned)      → OCR → bank_accounts + bank_statements
 *   - Kotak pdf               → bank_accounts + bank_statements
 *
 * All amounts stored in paisa (× 100). Run with:
 *   node --env-file=.env.local scripts/import-finance-files.mjs
 */

import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { PDFParse } from "pdf-parse";

const DOCS = "/Users/sahilaggarwal/Documents/Finance - Bank Statements";

// ─── Init Supabase ───────────────────────────────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// ─── Resolve company + uploader ──────────────────────────────────────────────

const { data: cmp } = await db.from("companies").select("id").order("sort_order").limit(1).single();
const COMPANY_ID = cmp.id;

const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;

console.log(`Company: ${COMPANY_ID}  Uploader: ${UPLOADER}`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inPaisa = (rupees) => Math.round(Number(rupees || 0) * 100);

function inferFY(iso) {
  const y = parseInt(iso.slice(0, 4));
  const m = parseInt(iso.slice(5, 7));
  return m >= 4 ? `${y}-${String(y + 1).slice(2)}` : `${y - 1}-${String(y).slice(2)}`;
}

function toIso(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  if (typeof d === "number") {
    const c = XLSX.SSF.parse_date_code(d);
    if (c) return `${c.y}-${String(c.m).padStart(2, "0")}-${String(c.d).padStart(2, "0")}`;
    return null;
  }
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m1) {
    let y = m1[3];
    if (y.length === 2) y = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  }
  const m2 = s.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
  if (m2) {
    const M = {
      jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
      jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    };
    return `${m2[3]}-${M[m2[2].toLowerCase()]}-${m2[1].padStart(2, "0")}`;
  }
  return null;
}

function parseRupees(s) {
  if (s === null || s === undefined || s === "") return 0;
  if (typeof s === "number") return Math.abs(s);
  const cleaned = String(s).replace(/[₹,\s]/g, "").replace(/[+]/, "").replace(/^\((.+)\)$/, "-$1");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : Math.abs(n);
}

function readXlsx(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true, dateNF: "dd/mm/yyyy" });
  return wb.SheetNames.map((sn) => ({
    sheetName: sn,
    matrix: XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: null, blankrows: false }),
  }));
}

async function extractPdfText(path) {
  const buf = readFileSync(path);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const r = await parser.getText();
  await parser.destroy();
  return { text: r.text, pages: r.total };
}

async function ocrPdf(path) {
  const buf = readFileSync(path);
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const info = await parser.getText();
  const totalPages = info.total;
  await parser.destroy();

  // Render each page at scale 3 then OCR
  const { default: Tesseract } = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng");
  const texts = [];
  for (let p = 1; p <= totalPages; p++) {
    const parser2 = new PDFParse({ data: new Uint8Array(buf) });
    const ss = await parser2.getScreenshot({ first: p, last: p, scale: 3 });
    await parser2.destroy();
    if (!ss.pages?.[0]) continue;
    const tmp = join(tmpdir(), `ocr-${Date.now()}-p${p}.png`);
    writeFileSync(tmp, ss.pages[0].data);
    const result = await worker.recognize(tmp);
    texts.push(result.data.text);
    try { unlinkSync(tmp); } catch {}
    process.stdout.write(`  OCR page ${p}/${totalPages}\r`);
  }
  await worker.terminate();
  console.log();
  return texts.join("\n");
}

// ─── DB helpers (batched inserts, dedup vendors/customers) ──────────────────

const vendorCache = new Map();   // lowercased name → id
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
  const { data, error } = await db
    .from("vendors")
    .insert({ name: name.trim(), company_id: COMPANY_ID, ...extra })
    .select("id")
    .single();
  if (error) {
    // Race / unique-violation — re-fetch
    const { data: existing } = await db
      .from("vendors").select("id").eq("name", name.trim()).eq("company_id", COMPANY_ID).maybeSingle();
    if (existing) { vendorCache.set(key, existing.id); return existing.id; }
    throw new Error(`vendor insert "${name}": ${error.message}`);
  }
  vendorCache.set(key, data.id);
  return data.id;
}

async function ensureCustomer(name, extra = {}) {
  const key = name.toLowerCase().trim();
  if (customerCache.has(key)) return customerCache.get(key);
  const { data, error } = await db
    .from("customers")
    .insert({ name: name.trim(), company_id: COMPANY_ID, ...extra })
    .select("id")
    .single();
  if (error) {
    const { data: existing } = await db
      .from("customers").select("id").eq("name", name.trim()).eq("company_id", COMPANY_ID).maybeSingle();
    if (existing) { customerCache.set(key, existing.id); return existing.id; }
    throw new Error(`customer insert "${name}": ${error.message}`);
  }
  customerCache.set(key, data.id);
  return data.id;
}

async function createImport(file_name, file_type, module) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type, module,
    uploaded_by: UPLOADER,
    company_id: COMPANY_ID,
    status: "processing",
    financial_year: "2026-27",
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
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await db.from(table).insert(batch);
    if (error) throw new Error(`${table} batch ${i}: ${error.message}`);
    inserted += batch.length;
    process.stdout.write(`  ${table}: ${inserted}/${rows.length}\r`);
  }
  console.log();
  return inserted;
}

// ─── 1. DAY BOOK ─────────────────────────────────────────────────────────────

async function importDayBook() {
  const fname = "DAY BOOK (APRIL-MAY).xlsx";
  console.log(`\n▶ ${fname}`);
  const sheets = readXlsx(`${DOCS}/${fname}`);
  const matrix = sheets[0].matrix;

  const import_id = await createImport(fname, "xlsx", "transactions");
  const txns = [];

  // Header at row 5, data from row 6+. Carry forward date/type/voucher when null.
  let curDate = null, curType = null, curVch = null;
  let totalRows = 0;
  for (let i = 6; i < matrix.length; i++) {
    const [date, type, vch, account, debit, credit] = matrix[i];
    if (date) curDate = toIso(date);
    if (type) curType = String(type).trim();
    if (vch !== null && vch !== undefined && vch !== "") curVch = String(vch).trim();

    if (!curDate || !account) continue;
    // Skip Busy report footer rows (grand totals)
    const acctName = String(account).trim();
    if (/^(grand\s+)?total$/i.test(acctName)) continue;
    const dr = parseRupees(debit), cr = parseRupees(credit);
    if (dr === 0 && cr === 0) continue;

    txns.push({
      transaction_date: curDate,
      voucher_number:   curVch,
      voucher_type:     curType || "Journal",
      ledger_name:      String(account).trim(),
      amount:           dr > 0 ? dr : cr,
      dr_cr:            dr > 0 ? "DR" : "CR",
      narration:        null,
      financial_year:   inferFY(curDate),
      import_id,
      company_id:       COMPANY_ID,
    });
    totalRows++;
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Day book: ${ok} transaction rows`);
  return { file: fname, imported: ok };
}

// ─── 2. SALE REGISTER ───────────────────────────────────────────────────────

async function importSaleRegister() {
  const fname = "SALE REGISTER(APRIL-MAY).xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`)[0].matrix;
  const import_id = await createImport(fname, "xlsx", "transactions");

  // Header at row 5: Date | Vch/Bill No | Account | TIN/GSTIN | Type | Total Amount | ...
  const txns = [];
  const customerSet = new Map(); // name → gstin (best guess)
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 6) continue;
    const [date, vch, account, gstin, type, total] = row;
    const iso = toIso(date);
    if (!iso || !account) continue;
    const amt = parseRupees(total);
    if (amt === 0) continue;
    const name = String(account).trim();
    if (gstin && !customerSet.has(name)) customerSet.set(name, String(gstin).trim() || null);
    else if (!customerSet.has(name)) customerSet.set(name, null);
    txns.push({
      transaction_date: iso,
      voucher_number:   vch ? String(vch).trim() : null,
      voucher_type:     "Sales",
      ledger_name:      name,
      amount:           amt,
      dr_cr:            "DR",   // customer is debited
      narration:        type ? `Sale ${type}` : "Sale",
      financial_year:   inferFY(iso),
      import_id,
      company_id:       COMPANY_ID,
    });
  }

  // Create customers
  let custCreated = 0;
  for (const [name, g] of customerSet) {
    const before = customerCache.size;
    await ensureCustomer(name, g ? { gstin: g } : {});
    if (customerCache.size > before) custCreated++;
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Sale Register: ${ok} sales, ${custCreated} new customers`);
  return { file: fname, imported: ok, customers: custCreated };
}

// ─── 3. PURCHASE REGISTER ───────────────────────────────────────────────────

async function importPurchaseRegister() {
  const fname = "PURCHASE REGISTER (APRIL-MAY).xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`)[0].matrix;
  const import_id = await createImport(fname, "xlsx", "transactions");

  const txns = [];
  const vendorSet = new Map();
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 6) continue;
    const [date, vch, account, gstin, type, total] = row;
    const iso = toIso(date);
    if (!iso || !account) continue;
    const amt = parseRupees(total);
    if (amt === 0) continue;
    const name = String(account).trim();
    if (gstin && !vendorSet.has(name)) vendorSet.set(name, String(gstin).trim() || null);
    else if (!vendorSet.has(name)) vendorSet.set(name, null);
    txns.push({
      transaction_date: iso,
      voucher_number:   vch ? String(vch).trim() : null,
      voucher_type:     "Purchase",
      ledger_name:      name,
      amount:           amt,
      dr_cr:            "CR",   // vendor is credited
      narration:        type ? `Purchase ${type}` : "Purchase",
      financial_year:   inferFY(iso),
      import_id,
      company_id:       COMPANY_ID,
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
  console.log(`✓ Purchase Register: ${ok} purchases, ${venCreated} new vendors`);
  return { file: fname, imported: ok, vendors: venCreated };
}

// ─── 4. PAYABLES (vendor balances as of 31-May-2026) ────────────────────────

async function importPayables() {
  const fname = "robo_AmountPayable.xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`)[0].matrix;
  const import_id = await createImport(fname, "xlsx", "payables");

  // Header at row 5: ["Account", "Balance"]. Data from row 6.
  const txns = [];
  let venCreated = 0;
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 2) continue;
    const [account, balance] = row;
    if (!account) continue;
    const name = String(account).trim();
    if (/^total/i.test(name) || /^grand/i.test(name)) continue;
    const amt = parseRupees(balance);
    if (amt === 0) continue;

    const before = vendorCache.size;
    await ensureVendor(name);
    if (vendorCache.size > before) venCreated++;

    txns.push({
      transaction_date: "2026-05-31",
      voucher_number:   `OB-${name.slice(0, 8).toUpperCase()}`.replace(/\s/g, ""),
      voucher_type:     "OpeningBalance",
      ledger_name:      name,
      amount:           amt,
      dr_cr:            "CR",   // payable: vendor liability is credit
      narration:        "Outstanding payable as on 31-May-2026",
      financial_year:   "2026-27",
      import_id,
      company_id:       COMPANY_ID,
    });
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Payables: ${ok} vendor balances (${venCreated} new vendors)`);
  return { file: fname, imported: ok, vendors: venCreated };
}

// ─── 5. RECEIVABLES (customer balances as of 31-May-2026) ───────────────────

async function importReceivables() {
  const fname = "robo_AMOUNTRECEIVABLE.xlsx";
  console.log(`\n▶ ${fname}`);
  const matrix = readXlsx(`${DOCS}/${fname}`)[0].matrix;
  const import_id = await createImport(fname, "xlsx", "receivables");

  const txns = [];
  let custCreated = 0;
  for (let i = 6; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.length < 2) continue;
    const [account, balance] = row;
    if (!account) continue;
    const name = String(account).trim();
    if (/^total/i.test(name) || /^grand/i.test(name)) continue;
    const amt = parseRupees(balance);
    if (amt === 0) continue;

    const before = customerCache.size;
    await ensureCustomer(name);
    if (customerCache.size > before) custCreated++;

    txns.push({
      transaction_date: "2026-05-31",
      voucher_number:   `OB-${name.slice(0, 8).toUpperCase()}`.replace(/\s/g, ""),
      voucher_type:     "OpeningBalance",
      ledger_name:      name,
      amount:           amt,
      dr_cr:            "DR",   // receivable: customer owes us, asset = debit
      narration:        "Outstanding receivable as on 31-May-2026",
      financial_year:   "2026-27",
      import_id,
      company_id:       COMPANY_ID,
    });
  }

  const ok = await insertBatched("transactions", txns);
  await finishImport(import_id, ok);
  console.log(`✓ Receivables: ${ok} customer balances (${custCreated} new customers)`);
  return { file: fname, imported: ok, customers: custCreated };
}

// ─── 6. IDBI PDFs ────────────────────────────────────────────────────────────

function parseIdbiText(text) {
  // Lines have format:
  //   DD/MM/YYYY DESCRIPTION   Dr./Cr. INR AMOUNT   DATETIME   SRL  BALANCE
  // Some transactions wrap onto 2-3 lines.
  const rawLines = text.split(/\r?\n/);

  // First merge wrapped lines: a "transaction line" starts with DD/MM/YYYY and contains
  // either "Dr." or "Cr." with INR amount, ending with balance. If the Dr./Cr. is on
  // the same line, it's a single-line txn. If "Dr."/"Cr." appears further down without a
  // new date prefix, merge.
  const lines = [];
  let buf = "";
  for (const rawLine of rawLines) {
    const l = rawLine.trim();
    if (!l) { if (buf) { lines.push(buf); buf = ""; } continue; }
    if (/^\d{2}\/\d{2}\/\d{4}\b/.test(l)) {
      if (buf) lines.push(buf);
      buf = l;
    } else if (buf) {
      buf += " " + l;
    }
  }
  if (buf) lines.push(buf);

  const txns = [];
  for (const l of lines) {
    const m = l.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(.+?)\s+(Dr|Cr)\.?\s+INR\s+([\d,]+\.\d{2})\s+/i);
    if (!m) continue;
    const date = `${m[3]}-${m[2]}-${m[1]}`;
    const desc = m[4].trim();
    const isDebit = m[5].toLowerCase() === "dr";
    const amt = parseRupees(m[6]);
    // Balance is the last formatted number in the line
    const nums = [...l.matchAll(/\b\d{1,3}(?:,\d{2,3})+(?:\.\d{2})?\b|\b\d+\.\d{2}\b/g)];
    if (!nums.length) continue;
    const balance = parseRupees(nums[nums.length - 1][0]);
    txns.push({
      date, description: desc,
      debit: isDebit ? amt : 0,
      credit: isDebit ? 0 : amt,
      balance,
    });
  }
  return txns;
}

function extractIdbiMetadata(text) {
  const accMatch = text.match(/1009102000011811/);
  const periodMatch = text.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2})\/(\d{2})\/(\d{4})\s+Transaction\s+Date/i)
    || text.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+Transaction/i);
  let periodStart = null, periodEnd = null;
  if (periodMatch) {
    const m = periodMatch;
    if (m.length === 7) {
      periodStart = `${m[3]}-${m[2]}-${m[1]}`;
      periodEnd   = `${m[6]}-${m[5]}-${m[4]}`;
    } else {
      const a = m[1].split("/"); const b = m[2].split("/");
      periodStart = `${a[2]}-${a[1]}-${a[0]}`;
      periodEnd   = `${b[2]}-${b[1]}-${b[0]}`;
    }
  }
  const branch = (text.match(/DELHI\s*-\s*SHALIMAR\s*BAGH\s*BRANCH/i) || ["DELHI - SHALIMAR BAGH BRANCH"])[0];
  return {
    bankName: "IDBI Bank",
    accountNumber: accMatch ? "1009102000011811" : "1009102000011811",
    accountType: "current",
    branch: branch.replace(/\s+/g, " ").trim(),
    accountHolderName: "ROBOTEK LLP",
    periodStart, periodEnd,
    statementDate: periodEnd,
  };
}

async function importIdbi(fname, isFirstPeriod) {
  console.log(`\n▶ ${fname}`);
  const { text, pages } = await extractPdfText(`${DOCS}/${fname}`);
  console.log(`  PDF pages: ${pages}, text chars: ${text.length}`);

  const meta = extractIdbiMetadata(text);
  const txns = parseIdbiText(text);
  if (txns.length === 0) {
    console.log(`  ⚠ No transactions parsed`);
    return { file: fname, imported: 0 };
  }

  // Use earliest balance + earliest txn as opening, latest as closing
  // Statements are ordered newest-first → reverse for chronological
  txns.sort((a, b) => a.date.localeCompare(b.date));
  const openingBalance = txns[0].balance + (txns[0].debit - txns[0].credit); // reverse out first txn
  const closingBalance = txns[txns.length - 1].balance;

  const import_id = await createImport(fname, "pdf", "bank_statement");

  // Find or create account (shared between APRIL & MAY)
  let { data: acct } = await db.from("bank_accounts")
    .select("id, period_start, period_end, opening_balance, closing_balance")
    .eq("account_number", meta.accountNumber)
    .eq("company_id", COMPANY_ID)
    .maybeSingle();

  if (!acct) {
    const { data: created, error } = await db.from("bank_accounts").insert({
      bank_name: meta.bankName,
      account_number: meta.accountNumber,
      account_number_last4: meta.accountNumber.slice(-4),
      account_type: meta.accountType,
      account_holder_name: meta.accountHolderName,
      branch: meta.branch,
      opening_balance: inPaisa(openingBalance),
      closing_balance: inPaisa(closingBalance),
      period_start: meta.periodStart,
      period_end: meta.periodEnd,
      statement_date: meta.statementDate,
      is_primary: isFirstPeriod,
      import_id,
      company_id: COMPANY_ID,
    }).select("id").single();
    if (error) throw new Error(`bank_accounts: ${error.message}`);
    acct = created;
    console.log(`  ✓ Created account ${meta.bankName} ···${meta.accountNumber.slice(-4)}`);
  } else {
    // Extend period and update closing balance to latest
    const newStart = meta.periodStart && (!acct.period_start || meta.periodStart < acct.period_start)
      ? meta.periodStart : acct.period_start;
    const newEnd = meta.periodEnd && (!acct.period_end || meta.periodEnd > acct.period_end)
      ? meta.periodEnd : acct.period_end;
    await db.from("bank_accounts").update({
      period_start: newStart,
      period_end: newEnd,
      closing_balance: meta.periodEnd && (!acct.period_end || meta.periodEnd >= acct.period_end)
        ? inPaisa(closingBalance) : acct.closing_balance,
    }).eq("id", acct.id);
    console.log(`  ✓ Updated existing account`);
  }

  const rows = txns.map((t) => ({
    bank_account_id: acct.id,
    transaction_date: t.date,
    value_date: t.date,
    description: t.description,
    debit: inPaisa(t.debit),
    credit: inPaisa(t.credit),
    balance: inPaisa(t.balance),
    import_id,
  }));

  const ok = await insertBatched("bank_statements", rows);
  await finishImport(import_id, ok);
  console.log(`✓ ${fname}: ${ok} bank transactions`);
  return { file: fname, imported: ok };
}

// ─── 7. KOTAK PDF ────────────────────────────────────────────────────────────

function parseKotakText(text) {
  // Each transaction starts with "<srl> <DD MMM YYYY>" on a line by itself.
  // Collect everything until the next start (or EOF) and find the
  // amount+balance pair (e.g. "+50,000.00 1,29,429.07" or "-36,000.00 -61,726.93")
  // anywhere within the block.
  const MONTH = { jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
                  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12" };
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const startRe = /^(\d+)\s+(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/;
  const skipRe = [
    /^Statement\s+generated/i, /^--\s*\d+\s+of\s+\d+/, /^ROBOTEK\s+LLP$/i,
    /^Account\s+Statement\s+\d/i, /^#\s+TRANSACTION/i,
  ];
  const isSkip = (l) => skipRe.some((r) => r.test(l));

  const txns = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(startRe);
    if (!m) { i++; continue; }
    const date = `${m[4]}-${MONTH[m[3].toLowerCase()]}-${m[2]}`;
    // Gather block until next start
    const block = [];
    let j = i + 1;
    while (j < lines.length && !startRe.test(lines[j])) {
      if (!isSkip(lines[j])) block.push(lines[j]);
      j++;
    }
    i = j;

    // Skip time line (first one) if present
    if (block[0] && /^\d{2}:\d{2}\s*(AM|PM)$/i.test(block[0])) block.shift();

    // Find value date in first remaining line
    let valueDate = date;
    if (block.length > 0) {
      const vd = block[0].match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})\s*(.*)$/);
      if (vd) {
        valueDate = `${vd[3]}-${MONTH[vd[2].toLowerCase()]}-${vd[1]}`;
        block[0] = vd[4]; // keep rest as description
      }
    }

    // Look for amount + balance pattern within block (greedy scan, last match wins)
    const blockText = block.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const amtBalRe = /([+\-])([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})/g;
    let lastMatch = null, mm;
    while ((mm = amtBalRe.exec(blockText)) !== null) lastMatch = mm;

    if (!lastMatch) continue;

    const sign = lastMatch[1];
    const amt = parseRupees(lastMatch[2]);
    const bal = parseRupees(lastMatch[3]) * (lastMatch[3].startsWith("-") ? -1 : 1);
    const desc = blockText.slice(0, lastMatch.index).trim();

    txns.push({
      date,
      value_date: valueDate,
      description: desc.replace(/\s+/g, " ").trim() || "(no description)",
      debit: sign === "-" ? amt : 0,
      credit: sign === "+" ? amt : 0,
      balance: bal,
    });
  }
  return txns;
}

function extractKotakMetadata(text) {
  const m = text.match(/Account\s*#\s*(\d+)\s+(CURRENT|SAVINGS)/i);
  const accountNumber = m ? m[1] : "9810504008";
  const accountType = m ? m[2].toLowerCase() : "current";
  const ifscM = text.match(/IFSC\s+([A-Z]{4}\d+)/);
  const micrM = text.match(/MICR\s+(\d+)/);
  const branchM = text.match(/Branch\s+(.+?)(?:\n|$)/);
  const periodM = text.match(/(\d{2}\s+[A-Za-z]{3}\s+\d{4})\s*-\s*(\d{2}\s+[A-Za-z]{3}\s+\d{4})/);
  let periodStart = null, periodEnd = null;
  if (periodM) {
    periodStart = toIso(periodM[1]);
    periodEnd = toIso(periodM[2]);
  }
  return {
    bankName: "Kotak Mahindra Bank",
    accountNumber, accountType,
    branch: branchM ? branchM[1].trim() : "NEW DELHI - SHALIMAR BAGH",
    ifscCode: ifscM ? ifscM[1] : null,
    micrCode: micrM ? micrM[1] : null,
    accountHolderName: "Robotek LLP",
    periodStart, periodEnd,
    statementDate: periodEnd,
  };
}

async function importKotak() {
  const fname = "ROBOTEK (KOTAK).pdf";
  console.log(`\n▶ ${fname}`);
  const { text, pages } = await extractPdfText(`${DOCS}/${fname}`);
  console.log(`  PDF pages: ${pages}, text chars: ${text.length}`);

  const meta = extractKotakMetadata(text);
  const txns = parseKotakText(text);
  if (txns.length === 0) {
    console.log(`  ⚠ No transactions parsed`);
    return { file: fname, imported: 0 };
  }
  txns.sort((a, b) => a.date.localeCompare(b.date));
  const closingBalance = txns[txns.length - 1].balance;
  const openingBalance = txns[0].balance + (txns[0].debit - txns[0].credit);

  const import_id = await createImport(fname, "pdf", "bank_statement");
  const { data: created, error } = await db.from("bank_accounts").insert({
    bank_name: meta.bankName,
    account_number: meta.accountNumber,
    account_number_last4: meta.accountNumber.slice(-4),
    account_type: meta.accountType,
    account_holder_name: meta.accountHolderName,
    ifsc_code: meta.ifscCode,
    micr_code: meta.micrCode,
    branch: meta.branch,
    opening_balance: inPaisa(openingBalance),
    closing_balance: inPaisa(closingBalance),
    period_start: meta.periodStart,
    period_end: meta.periodEnd,
    statement_date: meta.statementDate,
    is_primary: false,
    import_id,
    company_id: COMPANY_ID,
  }).select("id").single();
  if (error) throw new Error(`kotak bank_accounts: ${error.message}`);

  const rows = txns.map((t) => ({
    bank_account_id: created.id,
    transaction_date: t.date,
    value_date: t.value_date,
    description: t.description,
    debit: inPaisa(t.debit),
    credit: inPaisa(t.credit),
    balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", rows);
  await finishImport(import_id, ok);
  console.log(`✓ Kotak: ${ok} transactions`);
  return { file: fname, imported: ok };
}

// ─── 8. HDFC PDF (scanned → OCR) ────────────────────────────────────────────

function parseHdfcOcrText(text) {
  // OCR'd HDFC format. Each transaction begins with "DD/MM/YY" at start of a line.
  // Description may wrap onto subsequent lines (lines that do NOT start with a date).
  // The amount and balance appear at the END of the FIRST line, in the form:
  //   ... DD/MM/YY AMOUNT BALANCE
  // where BALANCE may be negative.
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Skip rows that aren't transactions
  const isSkip = (l) =>
    /^Page\s+No/i.test(l) || /HDFC\s+BANK/i.test(l) || /HDFC\s+BANK\s+LIMITED/i.test(l) ||
    /Account\s+Branch|Account\s+Type|Account\s+Status|JOINT\s+HOLDERS/i.test(l) ||
    /Statement\s+From|Customer\s+Name|We\s+understand|Address|City\s*-/i.test(l) ||
    /Email|Phone|Cust\s+ID|AccountNo|A\/C\s+Open|Nomination|Branch\s+Code|MICR|Currency|OD\s+Limit/i.test(l) ||
    /Closing\s+balance\s+includes/i.test(l) || /Contents\s+of\s+this\s+statement/i.test(l) ||
    /Registered\s+Office|hdfcbank\.com|making-payments|State\s+account/i.test(l) ||
    /^M\/S\.|^SECTOR|^PLOT\s+NO|^NA$|^KUNDLI|^HARYANA|^DELHI|^NEW\s+DELHI|^BN-11/i.test(l) ||
    /ROBOTEKINDIA/i.test(l);

  const startRe = /^(\d{2})\/(\d{2})\/(\d{2})\s+(.+)$/;
  // Look for value_date + amount + balance at end of string (possibly with junk between)
  const tailRe = /(\d{2})\/(\d{2})\/(\d{2})[\s|]+([\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})\s*$/;

  // Group: collect each txn's first line + continuation lines
  const blocks = [];
  let cur = null;
  for (const l of lines) {
    if (isSkip(l)) { if (cur) { blocks.push(cur); cur = null; } continue; }
    const sm = l.match(startRe);
    if (sm) {
      if (cur) blocks.push(cur);
      cur = { firstLine: l, contLines: [] };
    } else if (cur) {
      cur.contLines.push(l);
    }
  }
  if (cur) blocks.push(cur);

  const txns = [];
  for (const b of blocks) {
    // Pull amount+balance from the first line tail
    const t = b.firstLine.match(tailRe);
    if (!t) continue;
    const dateM = b.firstLine.match(startRe);
    if (!dateM) continue;
    const txnDate  = `20${dateM[3]}-${dateM[2]}-${dateM[1]}`;
    const valDate  = `20${t[3]}-${t[2]}-${t[1]}`;
    const amount   = parseRupees(t[4]);
    const balanceStr = t[5];
    const balance  = parseRupees(balanceStr) * (balanceStr.startsWith("-") ? -1 : 1);

    // Description = first line minus the tail, joined with continuation
    const desc1 = b.firstLine.slice(dateM[1].length + 1 + dateM[2].length + 1 + dateM[3].length + 1, b.firstLine.length - t[0].length).trim();
    const description = [desc1, ...b.contLines].join(" ")
      .replace(/[|\[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    txns.push({ date: txnDate, value_date: valDate, description, amount, balance });
  }

  // Infer DR/CR by comparing CURRENT balance to PREVIOUS row's balance.
  //   B_i < B_{i-1}  →  current txn made balance worse  →  debit
  //   B_i > B_{i-1}  →  current txn made balance better →  credit
  // The amount should equal abs(B_i - B_{i-1}); we use that to validate.
  const result = [];
  for (let i = 0; i < txns.length; i++) {
    const t = txns[i];
    let isDebit;
    if (i > 0) {
      const prev = txns[i - 1];
      isDebit = t.balance < prev.balance;
      // Validate: |delta| should be ≈ amount; if mismatched by > ₹1, OCR likely misread
      const delta = Math.abs(t.balance - prev.balance);
      if (Math.abs(delta - t.amount) > 1) {
        // Fall back to next row instead
        if (i + 1 < txns.length) {
          const next = txns[i + 1];
          const nextDelta = Math.abs(next.balance - t.balance);
          if (Math.abs(nextDelta - next.amount) < 1) {
            isDebit = next.balance < t.balance;
          }
        }
      }
    } else if (txns.length > 1) {
      // First row: deduce from second row's balance change AND the second's amount
      const next = txns[1];
      // If row 2's amount matches |next.balance - t.balance|, then we know what t did:
      // we can't fully tell, default to debit if OD balance is large negative (statement starts with carry-forward debits).
      isDebit = next.balance < t.balance;
    } else {
      isDebit = false;
    }
    result.push({
      date: t.date,
      value_date: t.value_date,
      description: t.description,
      debit: isDebit ? t.amount : 0,
      credit: isDebit ? 0 : t.amount,
      balance: t.balance,
    });
  }
  return result;
}

function extractHdfcMetadata(text) {
  const acct = text.match(/AccountNo\s*~*\s*:\s*(\d+)/) || text.match(/Account\s*Number?\s*:?\s*(\d+)/);
  const ifsc = text.match(/IFSC[:\s]+([A-Z]{4}\d{7})/);
  const micr = text.match(/MICR\s*:?\s*(\d+)/);
  const period = text.match(/Statement\s*From\s*:?\s*(\d{2}\/\d{2}\/\d{4})\s*To\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const odLimit = text.match(/OD\s*Limit\s*:?\s*(\d+)/i);
  return {
    bankName: "HDFC Bank",
    accountNumber: acct ? acct[1] : "50200115510589",
    accountType: "od",
    branch: "SHALIMAR BAGH",
    accountHolderName: "M/S. ROBOTEK LLP",
    ifscCode: ifsc ? ifsc[1] : "HDFC0000331",
    micrCode: micr ? micr[1] : "110240051",
    periodStart: period ? toIso(period[1]) : null,
    periodEnd: period ? toIso(period[2]) : null,
    statementDate: period ? toIso(period[2]) : null,
    odLimit: odLimit ? parseInt(odLimit[1]) : null,
  };
}

async function importHdfc() {
  const fname = "ROBOTEK (HDFC).pdf";
  console.log(`\n▶ ${fname} (scanned PDF — running OCR, this takes a while)`);
  const text = await ocrPdf(`${DOCS}/${fname}`);
  console.log(`  OCR text: ${text.length} chars`);

  const meta = extractHdfcMetadata(text);
  console.log(`  Account: ${meta.accountNumber} | Period: ${meta.periodStart} → ${meta.periodEnd}`);

  const txns = parseHdfcOcrText(text);
  if (txns.length === 0) {
    console.log(`  ⚠ No transactions parsed`);
    return { file: fname, imported: 0 };
  }
  txns.sort((a, b) => a.date.localeCompare(b.date));
  const closingBalance = txns[txns.length - 1].balance;
  const openingBalance = txns[0].balance + (txns[0].debit - txns[0].credit);

  const import_id = await createImport(fname, "pdf", "bank_statement");
  const { data: created, error } = await db.from("bank_accounts").insert({
    bank_name: meta.bankName,
    account_number: meta.accountNumber,
    account_number_last4: meta.accountNumber.slice(-4),
    account_type: meta.accountType,
    account_holder_name: meta.accountHolderName,
    ifsc_code: meta.ifscCode,
    micr_code: meta.micrCode,
    branch: meta.branch,
    opening_balance: inPaisa(openingBalance),
    closing_balance: inPaisa(closingBalance),
    period_start: meta.periodStart,
    period_end: meta.periodEnd,
    statement_date: meta.statementDate,
    is_primary: false,
    import_id,
    company_id: COMPANY_ID,
  }).select("id").single();
  if (error) throw new Error(`hdfc bank_accounts: ${error.message}`);

  const rows = txns.map((t) => ({
    bank_account_id: created.id,
    transaction_date: t.date,
    value_date: t.value_date,
    description: t.description,
    debit: inPaisa(t.debit),
    credit: inPaisa(t.credit),
    balance: inPaisa(t.balance),
    import_id,
  }));
  const ok = await insertBatched("bank_statements", rows);
  await finishImport(import_id, ok);
  console.log(`✓ HDFC: ${ok} transactions`);
  return { file: fname, imported: ok };
}

// ─── Main ────────────────────────────────────────────────────────────────────

const results = [];
const errors = [];

await preloadParties();

async function run(name, fn) {
  try {
    const r = await fn();
    results.push(r);
  } catch (e) {
    console.error(`\n❌ ${name} failed:`, e.message);
    errors.push({ name, error: e.message });
  }
}

const ONLY = process.argv.slice(2);
const want = (key) => ONLY.length === 0 || ONLY.includes(key);

if (want("daybook"))     await run("DAY BOOK",       importDayBook);
if (want("sales"))       await run("SALE REGISTER",  importSaleRegister);
if (want("purchase"))    await run("PURCHASE",       importPurchaseRegister);
if (want("payables"))    await run("PAYABLES",       importPayables);
if (want("receivables")) await run("RECEIVABLES",    importReceivables);
if (want("idbi-apr"))    await run("IDBI APRIL",     () => importIdbi("IDBI APRIL.pdf", true));
if (want("idbi-may"))    await run("IDBI MAY",       () => importIdbi("IDBI MAY.pdf", false));
if (want("kotak"))       await run("KOTAK",          importKotak);
if (want("hdfc"))        await run("HDFC",           importHdfc);

console.log("\n═══════════════════════════════════════════════════");
console.log("  IMPORT SUMMARY");
console.log("═══════════════════════════════════════════════════");
for (const r of results) {
  console.log(`✓ ${r.file}: imported ${r.imported}` +
    (r.vendors !== undefined ? ` (vendors +${r.vendors})` : "") +
    (r.customers !== undefined ? ` (customers +${r.customers})` : ""));
}
for (const e of errors) console.log(`✗ ${e.name}: ${e.error}`);

// Final DB counts
const [{ count: cT }, { count: cS }, { count: cA }, { count: cV }, { count: cC }, { count: cI }] = await Promise.all([
  db.from("transactions").select("*", { count: "exact", head: true }),
  db.from("bank_statements").select("*", { count: "exact", head: true }),
  db.from("bank_accounts").select("*", { count: "exact", head: true }),
  db.from("vendors").select("*", { count: "exact", head: true }),
  db.from("customers").select("*", { count: "exact", head: true }),
  db.from("file_imports").select("*", { count: "exact", head: true }),
]);
console.log("\nFinal DB row counts:");
console.log(`  transactions:     ${cT}`);
console.log(`  bank_statements:  ${cS}`);
console.log(`  bank_accounts:    ${cA}`);
console.log(`  vendors:          ${cV}`);
console.log(`  customers:        ${cC}`);
console.log(`  file_imports:     ${cI}`);
