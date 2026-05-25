/**
 * Cash Flow Statement aggregator — from bank_statements directly.
 *
 * Classifies each bank transaction by description keywords into:
 *   Operating  : customer receipts, vendor/supplier payments, salary, GST/TDS
 *   Investing  : capex, share purchase/sale, FD movements
 *   Financing  : loans (drawn/repaid), interest paid, dividend, capital infusion
 *
 * Returns rolling balance across all accounts, weekly + monthly totals,
 * and per-classification breakdowns.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type CashFlowClass = "operating" | "investing" | "financing";

export type CashFlowSection = {
  inflow: number;   // total credits
  outflow: number;  // total debits
  net: number;
};

export type CashFlowSummary = {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  byClass: Record<CashFlowClass, CashFlowSection>;
  weeklyTrend: Array<{ weekLabel: string; weekStart: string; inflow: number; outflow: number; net: number; }>;
  monthlyTrend: Array<{ month: string; period: string; inflow: number; outflow: number; net: number; }>;
  accountBalances: Array<{ bank: string; account: string; closing: number; type: string }>;
  recentTransactions: Array<{
    date: string; description: string; debit: number; credit: number; balance: number; bank: string; class: CashFlowClass;
  }>;
};

function classifyTransaction(desc: string): CashFlowClass {
  const d = desc.toLowerCase();
  // Financing
  if (/\b(loan|emi|interest|finance|rtgs.*loan|cc.*int|od.*int|odint|dividend|capital|share capital)\b/.test(d)) return "financing";
  // Investing
  if (/\b(fd |fixed deposit|investment|mutual fund|jm financial|equity|share|stock|capex|asset purchase|premat proceeds|sweep transfer)\b/.test(d)) return "investing";
  // Default operating (customer receipts, vendor payments, salary, tax, etc.)
  return "operating";
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoToWeek(iso: string): { label: string; start: string } {
  const d = new Date(iso + "T00:00:00");
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday-start week
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diff);
  const start = monday.toISOString().slice(0, 10);
  const label = `W/c ${monday.getUTCDate()}-${MONTH_LABELS[monday.getUTCMonth()]}`;
  return { label, start };
}

export async function fetchCashFlow(
  supabase: SupabaseClient<Database>,
  companyId: string | null,
): Promise<CashFlowSummary> {
  // Pull bank accounts for scope
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let baQ = (supabase as any).from("bank_accounts")
    .select("id, bank_name, account_number_last4, account_type, closing_balance");
  if (companyId) baQ = baQ.eq("company_id", companyId);
  const { data: accounts } = await baQ;

  type AcctRow = { id: string; bank_name: string; account_number_last4: string; account_type: string; closing_balance: number };
  const acctList = (accounts || []) as AcctRow[];
  const acctIds  = acctList.map((a) => a.id);

  if (acctIds.length === 0) {
    return {
      totalInflow: 0, totalOutflow: 0, netCashFlow: 0,
      byClass: { operating: { inflow:0, outflow:0, net:0 }, investing: { inflow:0, outflow:0, net:0 }, financing: { inflow:0, outflow:0, net:0 } },
      weeklyTrend: [], monthlyTrend: [], accountBalances: [], recentTransactions: [],
    };
  }

  // Pull bank statements (paginated)
  type Stmt = { transaction_date: string; description: string; debit: number; credit: number; balance: number; bank_account_id: string };
  const stmts: Stmt[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("bank_statements")
      .select("transaction_date, description, debit, credit, balance, bank_account_id")
      .in("bank_account_id", acctIds)
      .order("transaction_date", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    stmts.push(...(data as Stmt[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Build account name lookup
  const acctNameById = new Map(acctList.map((a) => [a.id, `${a.bank_name} ···${a.account_number_last4}`]));

  // Aggregate by class
  const byClass: CashFlowSummary["byClass"] = {
    operating: { inflow:0, outflow:0, net:0 },
    investing: { inflow:0, outflow:0, net:0 },
    financing: { inflow:0, outflow:0, net:0 },
  };
  let totalInflow = 0, totalOutflow = 0;

  // Weekly and monthly aggregation
  const weekMap = new Map<string, { label: string; start: string; inflow: number; outflow: number }>();
  const monthMap = new Map<string, { inflow: number; outflow: number }>();

  for (const s of stmts) {
    const debit  = Number(s.debit)  / 100; // paisa → rupees
    const credit = Number(s.credit) / 100;
    if (debit === 0 && credit === 0) continue;

    const cls = classifyTransaction(s.description);
    byClass[cls].inflow  += credit;
    byClass[cls].outflow += debit;
    totalInflow  += credit;
    totalOutflow += debit;

    // Week
    const { label, start } = isoToWeek(s.transaction_date);
    const w = weekMap.get(start) || { label, start, inflow: 0, outflow: 0 };
    w.inflow += credit; w.outflow += debit;
    weekMap.set(start, w);

    // Month
    const m = s.transaction_date.slice(0, 7);
    const mm = monthMap.get(m) || { inflow: 0, outflow: 0 };
    mm.inflow += credit; mm.outflow += debit;
    monthMap.set(m, mm);
  }

  for (const c of Object.keys(byClass) as CashFlowClass[]) {
    byClass[c].net = byClass[c].inflow - byClass[c].outflow;
  }

  // Last 8 weeks
  const weeklyTrend = [...weekMap.values()]
    .sort((a, b) => b.start.localeCompare(a.start))
    .slice(0, 8)
    .reverse()
    .map((w) => ({ weekLabel: w.label, weekStart: w.start, inflow: w.inflow, outflow: w.outflow, net: w.inflow - w.outflow }));

  // Last 6 months
  const monthlyTrend: CashFlowSummary["monthlyTrend"] = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const m = monthMap.get(key) || { inflow: 0, outflow: 0 };
    monthlyTrend.push({
      month: MONTH_LABELS[d.getMonth()],
      period: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
      inflow: m.inflow, outflow: m.outflow, net: m.inflow - m.outflow,
    });
  }

  // Recent transactions (top 25)
  const recentTransactions = stmts.slice(0, 25).map((s) => ({
    date: s.transaction_date,
    description: s.description,
    debit:  Number(s.debit)  / 100,
    credit: Number(s.credit) / 100,
    balance: Number(s.balance) / 100,
    bank: acctNameById.get(s.bank_account_id) || "—",
    class: classifyTransaction(s.description) as CashFlowClass,
  }));

  // Account balances summary
  const accountBalances = acctList.map((a) => ({
    bank: a.bank_name,
    account: `···${a.account_number_last4}`,
    closing: Number(a.closing_balance) / 100,
    type: a.account_type,
  }));

  return {
    totalInflow, totalOutflow, netCashFlow: totalInflow - totalOutflow,
    byClass, weeklyTrend, monthlyTrend, accountBalances, recentTransactions,
  };
}
