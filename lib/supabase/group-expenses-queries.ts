/**
 * Group expense aggregator — combines OpEx across all group companies for
 * the consolidated dashboard. Per-company column + grand totals per category
 * so the CEO can see at a glance where group spending is concentrated.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const CATEGORIES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Payroll & Salaries", pattern: /\b(salary|salaries|wages?|payroll|bonus|incentive|pf|esi|gratuity)\b/i },
  { name: "Rent & Premises",    pattern: /\b(rent|lease|premises|building|maintenance)\b/i },
  { name: "Utilities",          pattern: /\b(electricity|power|water|gas)\b/i },
  { name: "Internet & Telecom", pattern: /\b(internet|telephone|telecom|broadband|mobile|airtel|jio|vodafone|gigantic|infotel)\b/i },
  { name: "Freight & Logistics",pattern: /\b(freight|transport|courier|cartage|loading|shipping|logistics|ankita|godara|maersk|clearing)\b/i },
  { name: "Travel & Conveyance",pattern: /\b(travel|conveyance|hotel|taxi|uber|ola|petrol|fuel|diesel|airfare|airline|flight|train)\b/i },
  { name: "Professional Fees",  pattern: /\b(professional|consultancy|legal|audit|accounting|advisory|chartered|advocate)\b/i },
  { name: "Bank Charges",       pattern: /\b(bank charges?|ipay|imps|neft|rtgs|charges)\b/i },
  { name: "Office Expenses",    pattern: /\b(office|stationery|printing|repair|hardware|electrical|tools|consumable)\b/i },
  { name: "Marketing & Ads",    pattern: /\b(marketing|advertis|promotion|brand|meta|facebook|google ads?|instagram|boost)\b/i },
  { name: "IT & Software",      pattern: /\b(software|subscription|saas|hosting|domain|cloud|aws|azure|microsoft)\b/i },
  { name: "Insurance",          pattern: /\b(insurance|premium|policy)\b/i },
  { name: "TDS / Statutory",    pattern: /\b(tds|tcs|advance tax|cbdt|gst dep|custom duty)\b/i },
];

function categorise(name: string): string {
  for (const c of CATEGORIES) if (c.pattern.test(name)) return c.name;
  return "Other Expenses";
}

function isOpExLedger(name: string): boolean {
  const lower = name.toLowerCase();
  if (/\b(sales?|service rendered|revenue|income)\b/.test(lower)) return false;
  if (/\b(purchase|raw material|material consumed|trading)\b/.test(lower)) return false;
  if (/\b(cgst|sgst|igst|gst payable|gst receivable|tcs payable|round)\b/.test(lower)) return false;
  if (/\b(bank|cash|hdfc|idbi|kotak|sib|au small|on hand)\b/.test(lower)) return false;
  if (/\b(opening balance|stock|inventory|capital)\b/.test(lower)) return false;
  return true;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type GroupExpenseReport = {
  /** Active companies that have at least one expense entry this month */
  companies: Array<{ id: string; short_name: string; color_class: string }>;
  /** Rows of: category → per-company amount + total */
  rows: Array<{
    category: string;
    perCompany: Record<string, number>;   // companyId → ₹
    total: number;
  }>;
  /** Per-company column totals + overall total */
  columnTotals: Record<string, number>;
  grandTotal: number;
  /** Last 6 months trend across all companies */
  monthlyTrend: Array<{ month: string; period: string; amount: number }>;
  /** Top vendors across the group for the current month */
  topVendors: Array<{ vendor: string; amount: number; companies: string[] }>;
  /** YTD total */
  ytdTotal: number;
  /** vs previous month % */
  vsPrevMonthPct: number;
};

export async function fetchGroupExpenseReport(
  supabase: SupabaseClient<Database>,
): Promise<GroupExpenseReport> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (supabase as any)
    .from("companies")
    .select("id, short_name, color_class, status, sort_order")
    .eq("status", "active")
    .order("sort_order");

  type Co = { id: string; short_name: string; color_class: string; status: string; sort_order: number };
  const cos = (companies ?? []) as Co[];
  if (cos.length === 0) {
    return {
      companies: [], rows: [], columnTotals: {}, grandTotal: 0,
      monthlyTrend: [], topVendors: [], ytdTotal: 0, vsPrevMonthPct: 0,
    };
  }

  const today = new Date();
  const curM   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prevD  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevM  = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  type Txn = {
    transaction_date: string; voucher_type: string;
    ledger_name: string; amount: number; dr_cr: "DR" | "CR"; company_id: string;
  };
  const txns: Txn[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("transactions")
      .select("transaction_date, voucher_type, ledger_name, amount, dr_cr, company_id")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    txns.push(...(data as Txn[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Group cur-month expenses by category × company
  const matrix     = new Map<string, Map<string, number>>(); // category → companyId → ₹
  const colTotals  = new Map<string, number>();              // companyId → ₹
  const monthTotal = new Map<string, number>();              // yyyy-mm → ₹
  const vendorTotal = new Map<string, { amount: number; cos: Set<string> }>();
  let curTotal = 0, prevTotal = 0, ytd = 0;

  for (const t of txns) {
    const vt = t.voucher_type.toLowerCase();
    if (t.dr_cr !== "DR") continue;
    if (vt !== "jrnl" && vt !== "journal" && vt !== "pymt" && vt !== "payment") continue;
    if (!isOpExLedger(t.ledger_name)) continue;
    const amt = Number(t.amount);

    ytd += amt;
    const m = t.transaction_date.slice(0, 7);
    monthTotal.set(m, (monthTotal.get(m) ?? 0) + amt);

    if (t.transaction_date.startsWith(curM)) {
      curTotal += amt;
      const cat = categorise(t.ledger_name);
      if (!matrix.has(cat)) matrix.set(cat, new Map());
      const row = matrix.get(cat)!;
      row.set(t.company_id, (row.get(t.company_id) ?? 0) + amt);
      colTotals.set(t.company_id, (colTotals.get(t.company_id) ?? 0) + amt);

      const v = vendorTotal.get(t.ledger_name) ?? { amount: 0, cos: new Set() };
      v.amount += amt;
      v.cos.add(t.company_id);
      vendorTotal.set(t.ledger_name, v);
    }
    if (t.transaction_date.startsWith(prevM)) prevTotal += amt;
  }

  // Filter to companies that actually have expenses this month
  const activeCompanies = cos.filter((c) => (colTotals.get(c.id) ?? 0) > 0);

  // Build rows sorted by total desc
  const rows = [...matrix.entries()]
    .map(([category, perCo]) => {
      const perCompany: Record<string, number> = {};
      let total = 0;
      for (const [cid, amt] of perCo.entries()) { perCompany[cid] = amt; total += amt; }
      return { category, perCompany, total };
    })
    .sort((a, b) => b.total - a.total);

  // Monthly trend (last 6 months)
  const monthlyTrend: GroupExpenseReport["monthlyTrend"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthlyTrend.push({
      month: MONTH_LABELS[d.getMonth()],
      period: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      amount: monthTotal.get(key) ?? 0,
    });
  }

  // Top vendors (across group, current month)
  const topVendors = [...vendorTotal.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, 10)
    .map(([vendor, v]) => {
      const companyNames = [...v.cos].map((cid) => cos.find((c) => c.id === cid)?.short_name ?? "—");
      return { vendor, amount: v.amount, companies: companyNames };
    });

  const colTotalsObj: Record<string, number> = {};
  for (const c of activeCompanies) colTotalsObj[c.id] = colTotals.get(c.id) ?? 0;

  return {
    companies: activeCompanies.map((c) => ({ id: c.id, short_name: c.short_name, color_class: c.color_class })),
    rows,
    columnTotals: colTotalsObj,
    grandTotal: curTotal,
    monthlyTrend,
    topVendors,
    ytdTotal: ytd,
    vsPrevMonthPct: prevTotal > 0 ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : 0,
  };
}
