/**
 * Expense Tracker queries — aggregate operating expenses from transactions.
 *
 * Pulls Jrnl / Journal vouchers (and Pymt vouchers tagged to expense ledgers),
 * filters out vendor/customer/cash/tax/Sale/Purchase ledgers, then groups by
 * an inferred expense category. Designed to work whether the user has Day Book
 * data (Robotek) or only Sales + Purchase register data (Muskan/Yuval).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type ExpenseRow = {
  date: string;
  voucher_number: string | null;
  voucher_type: string;
  ledger_name: string;
  amount: number;
  category: string;
};

export type ExpenseSummary = {
  totalMTD: number;          // current month total
  totalPrevMonth: number;
  monthOverMonthPct: number;
  byCategory: Array<{ category: string; amount: number; pct: number }>;
  byMonth: Array<{ month: string; period: string; amount: number }>;
  byVendor: Array<{ vendor: string; amount: number; pct: number }>;
  recentTxns: ExpenseRow[];

  /** Category × month matrix — last 6 months side-by-side, with trend flag */
  categoryMatrix: {
    monthHeaders: Array<{ key: string; label: string; isCurrent: boolean }>;
    rows: Array<{
      category: string;
      cells: number[];             // length = monthHeaders.length
      total6m: number;             // sum across the 6 months
      avg6m: number;
      latest: number;
      trend: "spike" | "up" | "flat" | "down" | "new";
      trendNote: string;           // e.g. "+25% vs avg" or "first month"
    }>;
    monthTotals: number[];
  };
};

/** Category buckets, ordered most-specific → least. Each is a /regex/. */
const CATEGORIES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Payroll & Salaries",     pattern: /\b(salary|salaries|wages?|payroll|bonus|incentive|pf|esi|gratuity|leave|provident)\b/i },
  { name: "Rent & Premises",        pattern: /\b(rent|lease|premises|building|maintenance)\b/i },
  { name: "Utilities",              pattern: /\b(electricity|power|water|gas|petrol|diesel|fuel)\b/i },
  { name: "Internet & Telecom",     pattern: /\b(internet|telephone|telecom|broadband|mobile|airtel|jio|vodafone|gigantic|infotel)\b/i },
  { name: "Freight & Logistics",    pattern: /\b(freight|transport|courier|cartage|loading|shipping|logistics|ankita|godara|maersk|clearing)\b/i },
  { name: "Travel & Conveyance",    pattern: /\b(travel|conveyance|hotel|taxi|uber|ola|petrol|fuel|airfare|airline|flight|train)\b/i },
  { name: "Professional Fees",      pattern: /\b(professional|consultancy|legal|audit|accounting|advisory|chartered|ca\b|cs\b|advocate)\b/i },
  { name: "Bank Charges",           pattern: /\b(bank charges?|ipay|imps|neft|rtgs|charges)\b/i },
  { name: "Office Expenses",        pattern: /\b(office|stationery|printing|repair|hardware|electrical|tools|consumable)\b/i },
  { name: "Marketing & Ads",        pattern: /\b(marketing|advertis|promotion|brand|meta|facebook|google ads?|instagram|boost)\b/i },
  { name: "IT & Software",          pattern: /\b(software|subscription|saas|hosting|domain|cloud|aws|azure|microsoft)\b/i },
  { name: "Insurance",              pattern: /\b(insurance|premium|policy)\b/i },
  { name: "TDS / Taxes (statutory)", pattern: /\b(tds|tcs|advance tax|cbdt|gst dep|custom duty)\b/i },
];

function categorise(ledgerName: string, narration: string | null): string {
  const haystack = `${ledgerName} ${narration ?? ""}`;
  for (const c of CATEGORIES) if (c.pattern.test(haystack)) return c.name;
  return "Other";
}

/** Skip ledgers that aren't operating expenses by their name pattern.
 *  Party-name exclusion (matching vendors / customers in the DB) is done
 *  separately in fetchExpenseSummary because it needs a DB lookup. */
function isOpExLedger(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (/\b(sales?|service rendered|revenue|income)\b/.test(lower)) return false;
  if (/^purchase$|\b(purchase|raw material|material consumed|trading)\b/.test(lower)) return false;
  // Statutory pass-through ledgers (tax payable, custom duty, wages payable
  // — these get DR'd during Pymt entries and net to zero on the P&L)
  if (/\b(cgst|sgst|igst|gst payable|gst receivable|tcs payable|tds payable|round|custom duty|duty payable|wages.*payable|salary.*payable|tds\b)\b/.test(lower)) return false;
  if (/\b(bank|cash|hdfc|idbi|kotak|sib|au small|on hand|axis|icici|sbi)\b/.test(lower)) return false;
  if (/\b(opening balance|stock|inventory|capital|reserve|drawings)\b/.test(lower)) return false;
  return true;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function fetchExpenseSummary(
  supabase: SupabaseClient<Database>,
  companyId: string | null,   // null = all companies
): Promise<ExpenseSummary> {
  const today = new Date();
  const curM   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prevD  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevM  = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  // Pre-load every vendor + customer name for the scope. Any ledger_name
  // matching one of these is a balance-sheet party movement (Pymt /
  // settlement) — not an operating expense — and is excluded below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vendorQ   = (supabase as any).from("vendors").select("name");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customerQ = (supabase as any).from("customers").select("name");
  if (companyId) {
    vendorQ   = vendorQ.eq("company_id", companyId);
    customerQ = customerQ.eq("company_id", companyId);
  }
  const [{ data: vendors }, { data: customers }] = await Promise.all([vendorQ, customerQ]);
  const partyNames = new Set<string>();
  for (const v of (vendors ?? []) as Array<{ name: string }>)   partyNames.add(v.name.toLowerCase().trim());
  for (const c of (customers ?? []) as Array<{ name: string }>) partyNames.add(c.name.toLowerCase().trim());

  // Pull all transactions for the scope (paginated). For the consolidated
  // view we accept all companies — the aggregator slices on company_id below.
  type Txn = {
    transaction_date: string; voucher_number: string | null; voucher_type: string;
    ledger_name: string; amount: number; dr_cr: "DR" | "CR"; narration: string | null;
  };
  const txns: Txn[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from("transactions")
      .select("transaction_date, voucher_number, voucher_type, ledger_name, amount, dr_cr, narration");
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    txns.push(...(data as Txn[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Filter to TRUE expense entries: DR side of Jrnl / Journal vouchers
  // to expense-like ledgers (NOT to a vendor/customer ledger).
  // Pymt vouchers are excluded entirely — they are AP settlements
  // (DR vendor / CR bank), already captured as expense when the
  // original Jrnl created the AP.
  const expRows: ExpenseRow[] = [];
  for (const t of txns) {
    if (t.dr_cr !== "DR") continue;
    const vt = t.voucher_type.toLowerCase();
    if (vt !== "jrnl" && vt !== "journal") continue;
    if (partyNames.has(t.ledger_name.toLowerCase().trim())) continue;
    if (!isOpExLedger(t.ledger_name)) continue;
    expRows.push({
      date: t.transaction_date,
      voucher_number: t.voucher_number,
      voucher_type: t.voucher_type,
      ledger_name: t.ledger_name,
      amount: Number(t.amount),
      category: categorise(t.ledger_name, t.narration),
    });
  }

  // Aggregate by category + by month + by vendor
  const catTotals = new Map<string, number>();
  const monthTotals = new Map<string, number>();
  const vendorTotals = new Map<string, number>();
  let totalMTD = 0, totalPrev = 0;

  for (const r of expRows) {
    if (r.date.startsWith(curM))  totalMTD += r.amount;
    if (r.date.startsWith(prevM)) totalPrev += r.amount;
    if (r.date.startsWith(curM)) {
      catTotals.set(r.category, (catTotals.get(r.category) || 0) + r.amount);
      vendorTotals.set(r.ledger_name, (vendorTotals.get(r.ledger_name) || 0) + r.amount);
    }
    const m = r.date.slice(0, 7);
    monthTotals.set(m, (monthTotals.get(m) || 0) + r.amount);
  }

  // Last 6 months trend
  const byMonth: ExpenseSummary["byMonth"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.push({
      month: MONTH_LABELS[d.getMonth()],
      period: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      amount: monthTotals.get(key) || 0,
    });
  }

  // Category breakdown (current month)
  const byCategory = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, amount]) => ({
      category,
      amount,
      pct: totalMTD > 0 ? Math.round((amount / totalMTD) * 100) : 0,
    }));

  // Top vendors (current month)
  const byVendor = [...vendorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([vendor, amount]) => ({
      vendor,
      amount,
      pct: totalMTD > 0 ? Math.round((amount / totalMTD) * 100) : 0,
    }));

  // Recent transactions (latest 50)
  const recentTxns = [...expRows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 50);

  const monthOverMonthPct = totalPrev > 0
    ? Math.round(((totalMTD - totalPrev) / totalPrev) * 100)
    : 0;

  // ── Build the 6-month category × month matrix ─────────────────────────
  // Headers for the last 6 months (oldest → newest)
  const monthHeaders: ExpenseSummary["categoryMatrix"]["monthHeaders"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthHeaders.push({
      key,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      isCurrent: i === 0,
    });
  }

  // Build category × month grid from every expense row (all 6 months)
  const grid = new Map<string, number[]>(); // category → cells[6]
  for (const r of expRows) {
    const key = r.date.slice(0, 7);
    const colIdx = monthHeaders.findIndex((h) => h.key === key);
    if (colIdx === -1) continue;            // outside the 6-month window
    if (!grid.has(r.category)) grid.set(r.category, new Array(monthHeaders.length).fill(0));
    grid.get(r.category)![colIdx] += r.amount;
  }

  // Build rows with trend analysis
  const matrixRows: ExpenseSummary["categoryMatrix"]["rows"] = [];
  for (const [category, cells] of grid) {
    const total6m = cells.reduce((s, c) => s + c, 0);
    if (total6m === 0) continue;
    const latest = cells[cells.length - 1] ?? 0;
    const nonZeroCells = cells.filter((c) => c > 0);
    const avg6m = nonZeroCells.length > 0 ? total6m / nonZeroCells.length : 0;
    const priorMonths = cells.slice(0, -1);
    const priorAvg = priorMonths.filter((c) => c > 0).length > 0
      ? priorMonths.reduce((s, c) => s + c, 0) / priorMonths.filter((c) => c > 0).length
      : 0;

    // Classify trend
    let trend: "spike" | "up" | "flat" | "down" | "new";
    let trendNote: string;
    if (priorAvg === 0 && latest > 0) { trend = "new"; trendNote = "first month"; }
    else if (latest === 0)             { trend = "down"; trendNote = "no spend this month"; }
    else {
      const diff = (latest - priorAvg) / priorAvg;
      const pct = Math.round(diff * 100);
      if (diff >= 0.5)        { trend = "spike"; trendNote = `+${pct}% vs avg`; }
      else if (diff >= 0.15)  { trend = "up";    trendNote = `+${pct}% vs avg`; }
      else if (diff <= -0.15) { trend = "down";  trendNote = `${pct}% vs avg`; }
      else                    { trend = "flat";  trendNote = `${pct >= 0 ? "+" : ""}${pct}% vs avg`; }
    }

    matrixRows.push({ category, cells, total6m, avg6m, latest, trend, trendNote });
  }
  matrixRows.sort((a, b) => b.total6m - a.total6m);

  const monthColTotals = monthHeaders.map((_, i) =>
    matrixRows.reduce((s, r) => s + (r.cells[i] ?? 0), 0)
  );

  return {
    totalMTD, totalPrevMonth: totalPrev, monthOverMonthPct,
    byCategory, byMonth, byVendor, recentTxns,
    categoryMatrix: { monthHeaders, rows: matrixRows, monthTotals: monthColTotals },
  };
}
