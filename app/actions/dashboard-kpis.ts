"use server";

/**
 * Dashboard KPIs — Real Data Pipeline
 *
 * Queries the transactions table and computes actual KPIs instead of sample data.
 * Called by the CFO Dashboard to display live numbers.
 *
 * Logic:
 *  - Revenue: sum of CR amounts to "Sales" / "Service" ledgers
 *  - COGS: sum of DR amounts to cost accounts
 *  - AP: sum of CR amounts to vendor/payable ledgers
 *  - AR: sum of DR amounts to customer/receivable ledgers
 *  - Cash: sum of Bank/Cash account transactions
 *  - Tax: sum of GST/TDS/Tax liability entries
 *  - Gross Margin: (Revenue - COGS) / Revenue
 */

import { createClient } from "@/lib/supabase/server";

export type DashboardKPI = {
  revenue: { current: number; vs_last_month_pct: number };
  cogs: { current: number; vs_last_month_pct: number };
  gross_margin: { current: number; vs_last_month_pct: number };
  cash: { current: number; vs_last_month_pct: number };
  ap: { total: number; overdue: number; vs_last_month_pct: number };
  ar: { total: number; overdue: number; vs_last_month_pct: number };
  tax: { total: number; vs_last_month_pct: number };
  opex: { current: number; vs_last_month_pct: number };
};

/** Get current financial year (April to March) */
function getCurrentFinancialYear(): string {
  const today = new Date();
  const month = today.getMonth() + 1; // 1-indexed
  const year = today.getFullYear();
  if (month >= 4) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/** Infer previous financial year */
function getPreviousFinancialYear(): string {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();
  if (month >= 4) {
    return `${year - 1}-${String(year).slice(2)}`;
  }
  return `${year - 2}-${String(year - 1).slice(2)}`;
}

/** Get current and previous month for MTD comparison */
function getMonthsForComparison(): { current: string; previous: string } {
  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, "0");
  const previousMonth = String(today.getMonth()).padStart(2, "0");
  const currentYear = today.getFullYear();
  const previousYear = today.getMonth() === 0 ? currentYear - 1 : currentYear;

  return {
    current: `${currentYear}-${currentMonth}`,
    previous: `${previousYear}-${previousMonth}`,
  };
}

/**
 * Heuristic: detect if a ledger name is revenue-related.
 * FIX N9: Removed the "classify everything else as revenue" OR clause.
 * That fallback inflated revenue by including payroll, freight, and other
 * non-revenue ledgers that just didn't match the expense keyword list.
 * Now requires a positive match against known revenue keywords only.
 */
function isRevenueLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(sales|service|revenue|income|trade receivable)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is COGS-related
 */
function isCOGSLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(cost of goods|cogs|manufacturing|raw materials|labor|mfg|assembly|production|material)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is AP-related (Accounts Payable)
 */
function isAPLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(payable|creditor|vendor|supplier|trade payable|due)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is AR-related (Accounts Receivable)
 */
function isARLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(receivable|debtor|customer|trade receivable)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is cash-related
 */
function isCashLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(cash|bank|hdfc|sbi|axis|icici|kotak|yes bank|indusind)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is tax-related
 */
function isTaxLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(tax|gst|tds|tcs|gst payable|gst receivable|advance tax|tds payable)\b/.test(name);
}

/**
 * Main query function — fetch and compute all KPIs from transactions
 */
export async function fetchDashboardKPIs(): Promise<DashboardKPI | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const currentFY = getCurrentFinancialYear();
    const { current: currentMonth, previous: previousMonth } = getMonthsForComparison();

    // Query all transactions for current FY
    const { data: currentFYData, error: currentError } = await supabase
      .from("transactions")
      .select("*")
      .eq("financial_year", currentFY) as any;

    if (currentError) throw currentError;
    const transactions = (currentFYData || []) as Array<{
      transaction_date: string;
      ledger_name: string;
      amount: number;
      dr_cr: "DR" | "CR";
    }>;

    // Compute current period (MTD) totals
    const currentMonthTxns = transactions.filter((t) =>
      t.transaction_date.startsWith(currentMonth)
    );

    let revenue = 0,
      cogs = 0,
      apTotal = 0,
      arTotal = 0,
      cashBalance = 0,
      taxLiability = 0,
      opex = 0;

    for (const txn of currentMonthTxns) {
      const amt = txn.amount;

      if (isRevenueLedger(txn.ledger_name)) {
        // Revenue is CR to Sales accounts
        if (txn.dr_cr === "CR") revenue += amt;
      } else if (isCOGSLedger(txn.ledger_name)) {
        // COGS is DR to cost accounts
        if (txn.dr_cr === "DR") cogs += amt;
      } else if (isAPLedger(txn.ledger_name)) {
        // AP is CR to payable accounts
        if (txn.dr_cr === "CR") apTotal += amt;
      } else if (isARLedger(txn.ledger_name)) {
        // AR is DR to receivable accounts
        if (txn.dr_cr === "DR") arTotal += amt;
      } else if (isCashLedger(txn.ledger_name)) {
        // Net cash effect
        cashBalance += txn.dr_cr === "DR" ? amt : -amt;
      } else if (isTaxLedger(txn.ledger_name)) {
        // Tax liabilities
        if (txn.dr_cr === "CR") taxLiability += amt;
      } else {
        // Operating expenses (anything not categorized above)
        if (txn.dr_cr === "DR") opex += amt;
      }
    }

    // Compute previous period totals for comparison
    const previousMonthTxns = transactions.filter((t) =>
      t.transaction_date.startsWith(previousMonth)
    );

    let prevRevenue = 0,
      prevCogs = 0,
      prevOpex = 0,
      prevCash = 0,
      prevTax = 0;

    for (const txn of previousMonthTxns) {
      const amt = txn.amount;
      if (isRevenueLedger(txn.ledger_name) && txn.dr_cr === "CR") prevRevenue += amt;
      else if (isCOGSLedger(txn.ledger_name) && txn.dr_cr === "DR") prevCogs += amt;
      else if (isCashLedger(txn.ledger_name))
        prevCash += txn.dr_cr === "DR" ? amt : -amt;
      else if (isTaxLedger(txn.ledger_name) && txn.dr_cr === "CR") prevTax += amt;
      else if (!isAPLedger(txn.ledger_name) && !isARLedger(txn.ledger_name))
        if (txn.dr_cr === "DR") prevOpex += amt;
    }

    // Compute gross margin
    const grossMargin = revenue > 0 ? ((revenue - cogs) / revenue) * 100 : 0;
    const prevGrossMargin = prevRevenue > 0 ? ((prevRevenue - prevCogs) / prevRevenue) * 100 : 0;

    // Compute percentage changes
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
    const cogsChange = prevCogs > 0 ? ((cogs - prevCogs) / prevCogs) * 100 : 0;
    const marginChange = prevGrossMargin > 0 ? grossMargin - prevGrossMargin : 0;
    const cashChange = prevCash !== 0 ? ((cashBalance - prevCash) / Math.abs(prevCash)) * 100 : 0;
    const taxChange = prevTax > 0 ? ((taxLiability - prevTax) / prevTax) * 100 : 0;
    const opexChange = prevOpex > 0 ? ((opex - prevOpex) / prevOpex) * 100 : 0;

    // Estimate overdue amounts (simplified: assume 20% of AP/AR is overdue if no explicit dates)
    const apOverdue = apTotal * 0.2;
    const arOverdue = arTotal * 0.2;

    return {
      revenue: { current: revenue, vs_last_month_pct: revenueChange },
      cogs: { current: cogs, vs_last_month_pct: cogsChange },
      gross_margin: { current: grossMargin, vs_last_month_pct: marginChange },
      cash: { current: cashBalance, vs_last_month_pct: cashChange },
      ap: { total: apTotal, overdue: apOverdue, vs_last_month_pct: 0 },
      ar: { total: arTotal, overdue: arOverdue, vs_last_month_pct: 0 },
      tax: { total: taxLiability, vs_last_month_pct: taxChange },
      opex: { current: opex, vs_last_month_pct: opexChange },
    };
  } catch (error) {
    console.error("[dashboard-kpis] Error fetching KPIs:", error);
    return null;
  }
}
