/**
 * Reconciliation: for each party in robo_AmountPayable.xlsx and
 * robo_AMOUNTRECEIVABLE.xlsx, compute (Busy snapshot − current DB net) and
 * insert that difference as a 2026-04-01 OpeningBalance entry so the AP/AR
 * aging totals reconcile to the Busy snapshot.
 *
 * Run: node --env-file=.env.local scripts/add-opening-balances.mjs
 */
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "fs";

const DOCS = "/Users/sahilaggarwal/Documents/Finance - Bank Statements";

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: cmp } = await db.from("companies").select("id").order("sort_order").limit(1).single();
const COMPANY_ID = cmp.id;
const { data: ceo } = await db.from("users").select("id").eq("role", "ceo").limit(1).single();
const UPLOADER = ceo.id;

function readBalances(path) {
  const wb = XLSX.read(readFileSync(path), { type: "buffer", cellDates: true });
  const m = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, blankrows: false });
  // Header row 5: ["Account", "Balance"]. Data from row 6.
  const rows = [];
  for (let i = 6; i < m.length; i++) {
    const [name, bal] = m[i];
    if (!name) continue;
    const s = String(name).trim();
    if (/^(grand\s+)?total$/i.test(s)) continue;
    const n = parseFloat(String(bal ?? "").replace(/[,₹\s]/g, "")) || 0;
    if (n === 0) continue;
    rows.push({ name: s, balance: n });
  }
  return rows;
}

async function currentNetByName(table, names, kind) {
  // For each name, fetch all transactions and compute current net outstanding
  // (vendor: CR-DR ; customer: DR-CR)
  const sign = kind === "vendor" ? { CR: 1, DR: -1 } : { DR: 1, CR: -1 };
  const result = new Map();
  const chunk = 200;
  for (let i = 0; i < names.length; i += chunk) {
    const slice = names.slice(i, i + chunk);
    const { data, error } = await db
      .from("transactions")
      .select("ledger_name, amount, dr_cr")
      .in("ledger_name", slice)
      .eq("company_id", COMPANY_ID);
    if (error) throw error;
    for (const t of data || []) {
      result.set(t.ledger_name, (result.get(t.ledger_name) || 0) + sign[t.dr_cr] * Number(t.amount));
    }
  }
  // Names with no transactions → 0
  for (const n of names) if (!result.has(n)) result.set(n, 0);
  return result;
}

async function createImport(file_name, module) {
  const { data, error } = await db.from("file_imports").insert({
    file_name, file_type: "xlsx", module,
    uploaded_by: UPLOADER, company_id: COMPANY_ID,
    status: "processing", financial_year: "2026-27",
  }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function reconcile(kind, fileName, partyTable) {
  const path = `${DOCS}/${fileName}`;
  const rows = readBalances(path);
  console.log(`\n▶ ${fileName} — ${rows.length} parties in snapshot`);

  // Lookup or create party records (already created during initial import in most cases)
  const names = rows.map((r) => r.name);
  const { data: existing } = await db.from(partyTable)
    .select("id, name").in("name", names).eq("company_id", COMPANY_ID);
  const idByName = new Map((existing || []).map((p) => [p.name, p.id]));

  for (const r of rows) {
    if (!idByName.has(r.name)) {
      const { data: created, error } = await db.from(partyTable)
        .insert({ name: r.name, company_id: COMPANY_ID }).select("id").single();
      if (error) {
        // race / unique-violation – re-fetch
        const { data: again } = await db.from(partyTable).select("id").eq("name", r.name).eq("company_id", COMPANY_ID).maybeSingle();
        if (again) idByName.set(r.name, again.id);
      } else {
        idByName.set(r.name, created.id);
      }
    }
  }

  // Compute current net for each
  const currentByName = await currentNetByName(partyTable, names, kind);

  // Build OB rows for the gap
  const import_id = await createImport(fileName, kind === "vendor" ? "payables" : "receivables");
  const txns = [];
  let totalGap = 0, nonzero = 0;
  for (const r of rows) {
    const current = currentByName.get(r.name) || 0;
    const gap = r.balance - current; // positive = need to ADD this much old outstanding
    if (Math.abs(gap) < 1) continue; // skip if already reconciled
    nonzero++;
    totalGap += gap;
    txns.push({
      transaction_date: "2026-04-01",
      voucher_number: `OB-${kind === "vendor" ? "AP" : "AR"}-${nonzero}`,
      voucher_type: "OpeningBalance",
      ledger_name: r.name,
      amount: Math.abs(gap),
      dr_cr: kind === "vendor"
        ? (gap > 0 ? "CR" : "DR")
        : (gap > 0 ? "DR" : "CR"),
      narration: `Carry-forward opening balance from prior FY (per Busy ${kind === "vendor" ? "AP" : "AR"} snapshot 31-May-2026)`,
      financial_year: "2026-27",
      import_id,
      company_id: COMPANY_ID,
    });
  }

  if (txns.length > 0) {
    const { error } = await db.from("transactions").insert(txns);
    if (error) {
      await db.from("file_imports").update({ status: "failed", error_log: error.message }).eq("id", import_id);
      throw error;
    }
  }
  await db.from("file_imports").update({
    status: "completed", rows_imported: txns.length,
    completed_at: new Date().toISOString(),
  }).eq("id", import_id);

  console.log(`  Inserted ${txns.length} OB rows for ${nonzero} parties — total gap closed: ₹${totalGap.toLocaleString("en-IN")}`);
}

await reconcile("vendor",   "robo_AmountPayable.xlsx",       "vendors");
await reconcile("customer", "robo_AMOUNTRECEIVABLE.xlsx",    "customers");

console.log("\n✓ Done");
