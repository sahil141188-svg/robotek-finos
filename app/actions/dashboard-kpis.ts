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
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { buildPartyAging } from "@/lib/supabase/party-aging";

export type DashboardKPI = {
  revenue: { current: number; vs_last_month_pct: number };
  cogs: { current: number; vs_last_month_pct: number };
  gross_margin: { current: number; vs_last_month_pct: number };
  cash: { current: number; vs_last_month_pct: number };
  ap: { total: number; overdue: number; vs_last_month_pct: number };
  ar: { total: number; overdue: number; vs_last_month_pct: number };
  tax: { total: number; vs_last_month_pct: number };
  opex: { current: number; vs_last_month_pct: number };
  // Optional chart-ready series (server populates when transactions exist).
  charts?: {
    revenueTrend: Array<{
      month: string;          // "Apr", "May", ...
      period: string;         // "Apr 2026"
      revenue: number;        // in rupees
      cogs: number;
      grossProfit: number;
    }>;
    expenseBreakdown: Array<{
      category: string;
      amount: number;         // in rupees
      color: string;
    }>;
    aging: Array<{
      bucket: string;         // "0-30d" / "31-60d" / "61-90d" / "90+d"
      ap: number;             // in rupees
      ar: number;
    }>;
  };
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

/** Get current and previous month for MTD comparison.
 *
 * Bug #17 fix: `String(today.getMonth()).padStart(2,"0")` gives "00" in January
 * because getMonth() is 0-based (January = 0). The query
 * `transaction_date.startsWith("2026-00")` never matches anything — the entire
 * previous-month comparison returned zero and every KPI showed 0% trend.
 */
function getMonthsForComparison(): { current: string; previous: string } {
  const today = new Date();
  const currentMonth = String(today.getMonth() + 1).padStart(2, "0"); // 1-indexed
  const currentYear  = today.getFullYear();

  // Previous month: January (getMonth()=0) → December of previous year
  const prevMonthNum  = today.getMonth(); // 0-based; January = 0
  const previousMonth = prevMonthNum === 0 ? "12" : String(prevMonthNum).padStart(2, "0");
  const previousYear  = prevMonthNum === 0 ? currentYear - 1 : currentYear;

  return {
    current:  `${currentYear}-${currentMonth}`,
    previous: `${previousYear}-${previousMonth}`,
  };
}

/**
 * Heuristic: detect if a ledger name is revenue-related.
 * Matches Busy's "Sale GST" / "Sale Local" / "Sale Inter-state" etc.
 */
function isRevenueLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(sales?|service|revenue|income|trade receivable)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is COGS-related.
 * In Busy the contra account for purchases is literally "Purchase" plus
 * line items like "Raw Material" / "Consumable Expenses".
 */
function isCOGSLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(purchase|cost of goods|cogs|manufacturing|raw materials?|labor|labour|mfg|assembly|production|material|consumable)\b/.test(name);
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
  return /\b(cash|bank|hdfc|sbi|axis|icici|kotak|idbi|yes bank|indusind|paytm|on hand)\b/.test(name);
}

/**
 * Heuristic: detect if a ledger is tax-related
 */
function isTaxLedger(ledgerName: string): boolean {
  const name = ledgerName.toLowerCase();
  return /\b(cgst|sgst|igst|gst|tds|tcs|advance tax|custom duty|tax payable)\b/.test(name);
}

/** Detect Busy voucher type for a sale (SupO = Supply Outward) */
function isSalesVoucher(voucherType: string): boolean {
  const v = voucherType.toLowerCase();
  return v === "supo" || v === "sales" || v === "sale" || v === "sirt" || v === "sale return";
}

/** Detect Busy voucher type for a purchase (SupI = Supply Inward) */
function isPurchaseVoucher(voucherType: string): boolean {
  const v = voucherType.toLowerCase();
  return v === "supi" || v === "purchase" || v === "purc" || v === "purchase return";
}

/**
 * Main query function — fetch and compute all KPIs from transactions
 */
export async function fetchDashboardKPIs(): Promise<DashboardKPI | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const companyId = await getSelectedCompanyId();
    const currentFY = getCurrentFinancialYear();
    const { current: currentMonth, previous: previousMonth } = getMonthsForComparison();

    // Pre-load party names so we can exclude their DR sides from OpEx
    // (a Jrnl DR to a vendor/customer is an AP/AR settlement, not an expense).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let vendorQ = (supabase as any).from("vendors").select("name");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let custQ   = (supabase as any).from("customers").select("name");
    if (companyId) { vendorQ = vendorQ.eq("company_id", companyId); custQ = custQ.eq("company_id", companyId); }
    const [{ data: _vendors }, { data: _customers }] = await Promise.all([vendorQ, custQ]);
    const partyNames = new Set<string>();
    for (const v of (_vendors   ?? []) as Array<{ name: string }>) partyNames.add(v.name.toLowerCase().trim());
    for (const c of (_customers ?? []) as Array<{ name: string }>) partyNames.add(c.name.toLowerCase().trim());

    // Query transactions for current FY, scoped to the selected company when set.
    // Supabase enforces a 1000-row default limit; paginate via .range() so we
    // capture every row in a full Day Book (4k-10k entries is normal).
    type Txn = {
      transaction_date: string;
      voucher_type: string;
      ledger_name: string;
      amount: number;
      dr_cr: "DR" | "CR";
    };
    const transactions: Txn[] = [];
    const PAGE = 1000;
    let fromRow = 0;
    let companyMissing = false;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let txnQuery = (supabase as any)
        .from("transactions")
        .select("transaction_date, voucher_type, ledger_name, amount, dr_cr")
        .eq("financial_year", currentFY);
      if (companyId && !companyMissing) txnQuery = txnQuery.eq("company_id", companyId);

      const { data: page, error } = await txnQuery.range(fromRow, fromRow + PAGE - 1);
      if (error) {
        if ((error as { code?: string }).code === "42703" && companyId) {
          console.warn("[dashboard-kpis] company_id column missing — run migration 006.");
          companyMissing = true;
          continue; // retry this page without the company filter
        }
        throw error;
      }
      if (!page || page.length === 0) break;
      transactions.push(...(page as Txn[]));
      if (page.length < PAGE) break;
      fromRow += PAGE;
    }

    // ── Per-month classifier ──────────────────────────────────────────────
    // Built around Busy's voucher_type signal. For each month we compute
    // revenue/COGS via two heuristics depending on the data shape:
    //   (A) "Day Book" shape: contra ledgers like "Sale GST" present —
    //       revenue = Σ CR to Sale ledgers; COGS = Σ DR to Purchase ledgers
    //   (B) "Register only" shape: each row is just one customer/vendor DR/CR —
    //       revenue = Σ DR (customer side of sales voucher); COGS = Σ CR
    //       (vendor side of purchase voucher); equivalent to gross invoice value.
    // We take whichever produces the larger figure per month — Day Book wins
    // when both heuristics fire because (A) excludes GST while (B) includes it.
    function totalsForMonth(monthPrefix: string) {
      const rows = transactions.filter((t) => t.transaction_date.startsWith(monthPrefix));
      let revenueA = 0, revenueB = 0;
      let cogsA = 0, cogsB = 0;
      let cashFlow = 0, taxLiab = 0, opex = 0;

      for (const t of rows) {
        const amt = Number(t.amount);
        const isSale = isSalesVoucher(t.voucher_type);
        const isPurc = isPurchaseVoucher(t.voucher_type);

        // Revenue heuristic A — CR to "Sale*" ledger
        if (isSale && t.dr_cr === "CR" && isRevenueLedger(t.ledger_name)) {
          revenueA += amt;
        }
        // Revenue heuristic B — DR side of a sales voucher (= customer charge,
        // includes GST). Used when Day Book contras are absent.
        if (isSale && t.dr_cr === "DR" && !isTaxLedger(t.ledger_name) && !isRevenueLedger(t.ledger_name)) {
          revenueB += amt;
        }

        // COGS heuristic A — DR to Purchase ledger
        if (isPurc && t.dr_cr === "DR" && isCOGSLedger(t.ledger_name)) {
          cogsA += amt;
        }
        // COGS heuristic B — CR side of purchase voucher (= vendor liability)
        if (isPurc && t.dr_cr === "CR" && !isTaxLedger(t.ledger_name) && !isCOGSLedger(t.ledger_name)) {
          cogsB += amt;
        }

        // Cash movement: any txn touching a bank/cash ledger
        if (isCashLedger(t.ledger_name)) {
          cashFlow += t.dr_cr === "DR" ? amt : -amt;
        }
        // Tax liability: CR to tax ledgers (output GST/TDS) minus DR (input credit)
        else if (isTaxLedger(t.ledger_name)) {
          taxLiab += t.dr_cr === "CR" ? amt : -amt;
        }
        // Opex: DR to a TRUE expense ledger via Jrnl/Journal voucher
        // (excludes vendor/customer names by checking partyNames). Pymt
        // vouchers are intentionally excluded — they're AP settlements.
        else if (
          t.dr_cr === "DR" &&
          (t.voucher_type.toLowerCase() === "jrnl" || t.voucher_type.toLowerCase() === "journal") &&
          !partyNames.has(t.ledger_name.toLowerCase().trim()) &&
          !isCOGSLedger(t.ledger_name) && !isRevenueLedger(t.ledger_name) &&
          !isAPLedger(t.ledger_name) && !isARLedger(t.ledger_name)
        ) {
          opex += amt;
        }
      }
      const revenue = Math.max(revenueA, revenueB);
      const cogs = Math.max(cogsA, cogsB);
      return { revenue, cogs, cashFlow, taxLiab, opex };
    }

    const cur  = totalsForMonth(currentMonth);
    const prev = totalsForMonth(previousMonth);

    // ── Cash balance: prefer bank_accounts.closing_balance when available ─
    // The transaction-derived "cashFlow" is a net delta for the month, which
    // isn't a useful "Cash Balance" KPI on its own. Use the sum of imported
    // closing balances across all bank accounts as a snapshot.
    let cashSnapshot = 0;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bq = (supabase as any).from("bank_accounts").select("closing_balance");
      if (companyId) bq = bq.eq("company_id", companyId);
      const { data: bankAccts } = await bq;
      if (bankAccts && bankAccts.length > 0) {
        // closing_balance is stored in paisa → convert to rupees
        cashSnapshot = bankAccts.reduce(
          (sum: number, b: { closing_balance: number }) => sum + Number(b.closing_balance) / 100,
          0,
        );
      } else {
        cashSnapshot = cur.cashFlow;
      }
    } catch {
      cashSnapshot = cur.cashFlow;
    }

    // ── AP / AR: use shared aging engine for accurate totals + buckets ────
    let apTotal = 0, apOverdue = 0, arTotal = 0, arOverdue = 0;
    let apBuckets = { b0: 0, b1: 0, b2: 0, b3: 0 };
    let arBuckets = { b0: 0, b1: 0, b2: 0, b3: 0 };
    try {
      const [ap, ar] = await Promise.all([
        buildPartyAging(supabase, "vendor", companyId),
        buildPartyAging(supabase, "customer", companyId),
      ]);
      apTotal = ap.summary.total;     apOverdue = ap.summary.overdue;
      arTotal = ar.summary.total;     arOverdue = ar.summary.overdue;
      apBuckets = {
        b0: ap.summary.bucket0to30, b1: ap.summary.bucket31to60,
        b2: ap.summary.bucket61to90, b3: ap.summary.bucket90plus,
      };
      arBuckets = {
        b0: ar.summary.bucket0to30, b1: ar.summary.bucket31to60,
        b2: ar.summary.bucket61to90, b3: ar.summary.bucket90plus,
      };
    } catch (e) {
      console.warn("[dashboard-kpis] AP/AR aging unavailable:", (e as Error).message);
    }

    // ── Revenue / COGS trend: last 6 months ───────────────────────────────
    const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const today = new Date();
    const trend: Array<{ month: string; period: string; revenue: number; cogs: number; grossProfit: number }> = [];
    for (let offset = 5; offset >= 0; offset--) {
      const d = new Date(today.getFullYear(), today.getMonth() - offset, 1);
      const prefix = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const t = totalsForMonth(prefix);
      trend.push({
        month: MONTH_LABELS[d.getMonth()],
        period: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
        revenue: t.revenue,
        cogs: t.cogs,
        grossProfit: t.revenue - t.cogs,
      });
    }

    // ── Expense breakdown: top OpEx ledgers for current month ─────────────
    const CHART_COLORS = ["#E52D31", "#F7DA11", "#9A9596", "#852321", "#1F1B20", "#3b82f6", "#10b981", "#a855f7"];
    const opexByLedger = new Map<string, number>();
    for (const t of transactions) {
      if (!t.transaction_date.startsWith(currentMonth)) continue;
      const vt = t.voucher_type.toLowerCase();
      if (t.dr_cr !== "DR") continue;
      if (vt !== "jrnl" && vt !== "journal") continue;
      if (partyNames.has(t.ledger_name.toLowerCase().trim())) continue;
      if (isCOGSLedger(t.ledger_name) || isRevenueLedger(t.ledger_name) ||
          isAPLedger(t.ledger_name)   || isARLedger(t.ledger_name) ||
          isCashLedger(t.ledger_name) || isTaxLedger(t.ledger_name)) continue;
      opexByLedger.set(t.ledger_name, (opexByLedger.get(t.ledger_name) || 0) + Number(t.amount));
    }
    const expenseBreakdown = [...opexByLedger.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([category, amount], idx) => ({
        category,
        amount,
        color: CHART_COLORS[idx % CHART_COLORS.length],
      }));

    // ── Aging chart series ────────────────────────────────────────────────
    const agingChart = [
      { bucket: "0-30d",  ap: apBuckets.b0, ar: arBuckets.b0 },
      { bucket: "31-60d", ap: apBuckets.b1, ar: arBuckets.b1 },
      { bucket: "61-90d", ap: apBuckets.b2, ar: arBuckets.b2 },
      { bucket: "90+d",   ap: apBuckets.b3, ar: arBuckets.b3 },
    ];

    // ── Derived metrics ───────────────────────────────────────────────────
    const grossMargin     = cur.revenue  > 0 ? ((cur.revenue  - cur.cogs)  / cur.revenue ) * 100 : 0;
    const prevGrossMargin = prev.revenue > 0 ? ((prev.revenue - prev.cogs) / prev.revenue) * 100 : 0;

    const revenueChange = prev.revenue > 0 ? ((cur.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    const cogsChange    = prev.cogs    > 0 ? ((cur.cogs    - prev.cogs)    / prev.cogs)    * 100 : 0;
    const marginChange  = prevGrossMargin > 0 ? grossMargin - prevGrossMargin : 0;
    const taxChange     = prev.taxLiab > 0 ? ((cur.taxLiab - prev.taxLiab) / prev.taxLiab) * 100 : 0;
    const opexChange    = prev.opex    > 0 ? ((cur.opex    - prev.opex)    / prev.opex)    * 100 : 0;

    return {
      revenue:      { current: cur.revenue,    vs_last_month_pct: revenueChange },
      cogs:         { current: cur.cogs,       vs_last_month_pct: cogsChange    },
      gross_margin: { current: grossMargin,    vs_last_month_pct: marginChange  },
      cash:         { current: cashSnapshot,   vs_last_month_pct: 0             },
      ap:           { total: apTotal,          overdue: apOverdue, vs_last_month_pct: 0 },
      ar:           { total: arTotal,          overdue: arOverdue, vs_last_month_pct: 0 },
      tax:          { total: cur.taxLiab,      vs_last_month_pct: taxChange     },
      opex:         { current: cur.opex,       vs_last_month_pct: opexChange    },
      charts: {
        revenueTrend:     trend,
        expenseBreakdown,
        aging:            agingChart,
      },
    };
  } catch (error) {
    console.error("[dashboard-kpis] Error fetching KPIs:", error);
    return null;
  }
}
