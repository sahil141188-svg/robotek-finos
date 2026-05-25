/**
 * Profit & Loss Statement aggregator.
 *
 * For a given company (or all companies) and a given month, computes:
 *   Revenue
 *   - COGS
 *   = Gross Profit
 *   - Operating Expenses (Payroll, Rent, Utilities, ...)
 *   = EBITDA
 *   - Depreciation / Amortization (if any)
 *   - Interest expense (if any)
 *   = Profit Before Tax
 *   - Tax (net GST + TDS)
 *   = Net Profit
 *
 * Returns side-by-side: current month / previous month / YTD.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PnLSection = {
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;          // total operating expenses
  opexByCategory: Array<{ category: string; amount: number }>;
  ebitda: number;
  interest: number;
  depreciation: number;
  pbt: number;           // profit before tax
  tax: number;
  net: number;           // net profit
};

export type PnLPeriodKey =
  | "this_month" | "last_month"
  | "this_quarter" | "last_quarter"
  | "this_fy"    | "last_fy";

export type PnL = {
  fy: string;
  primary:   PnLSection;
  compare:   PnLSection;
  ytd:       PnLSection;
  primaryLabel: string;
  compareLabel: string;
  ytdLabel: string;
  selectedPeriod: PnLPeriodKey;
};

function isSalesVoucher(v: string): boolean {
  const s = v.toLowerCase();
  return s === "supo" || s === "sales" || s === "sale" || s === "sirt";
}
function isPurchaseVoucher(v: string): boolean {
  const s = v.toLowerCase();
  return s === "supi" || s === "purchase" || s === "purc";
}
function isRevenueLedger(name: string): boolean {
  return /\b(sales?|service|revenue|income|trade receivable)\b/i.test(name);
}
function isCOGSLedger(name: string): boolean {
  return /\b(purchase|cost of goods|cogs|manufacturing|raw materials?|labor|labour|mfg|material|consumable)\b/i.test(name);
}
function isInterestLedger(name: string): boolean {
  return /\b(interest|finance charge|loan interest)\b/i.test(name);
}
function isDepreciationLedger(name: string): boolean {
  return /\b(depreciation|amortization|amortisation)\b/i.test(name);
}
function isTaxLedger(name: string): boolean {
  return /\b(cgst|sgst|igst|gst payable|tds|tcs|advance tax|cbdt|income tax)\b/i.test(name);
}
function isExclusionLedger(name: string): boolean {
  const lower = name.toLowerCase().trim();
  if (/\b(bank|cash|hdfc|idbi|kotak|sib|au small|axis|icici|sbi|on hand)\b/.test(lower)) return true;
  if (/\b(opening balance|stock|inventory|capital|reserve|drawings|round)\b/.test(lower)) return true;
  // Statutory pass-through ledgers — netted out in the Tax line
  if (/\b(custom duty|duty payable|wages.*payable|salary.*payable|tds\b)\b/.test(lower)) return true;
  return false;
}

const CATEGORIES: Array<{ name: string; pattern: RegExp }> = [
  { name: "Payroll & Salaries", pattern: /\b(salary|salaries|wages?|payroll|bonus|pf|esi)\b/i },
  { name: "Rent & Premises",    pattern: /\b(rent|lease|premises|building)\b/i },
  { name: "Utilities",          pattern: /\b(electricity|power|water|gas)\b/i },
  { name: "Internet & Telecom", pattern: /\b(internet|telephone|telecom|broadband|gigantic|infotel)\b/i },
  { name: "Freight & Logistics",pattern: /\b(freight|transport|courier|cartage|shipping|logistics|clearing|maersk)\b/i },
  { name: "Professional Fees", pattern: /\b(professional|consultancy|legal|audit|advisory)\b/i },
  { name: "Bank Charges",      pattern: /\b(bank charges?|ipay|imps|neft|rtgs)\b/i },
  { name: "Office Expenses",   pattern: /\b(office|stationery|printing|repair|hardware|electrical|tools|consumable)\b/i },
  { name: "Marketing",         pattern: /\b(marketing|advertis|promotion|meta|google ads?|instagram)\b/i },
  { name: "Travel",            pattern: /\b(travel|conveyance|hotel|taxi|fuel|petrol|diesel)\b/i },
  { name: "Insurance",         pattern: /\b(insurance|premium|policy)\b/i },
];

function categorise(name: string): string {
  for (const c of CATEGORIES) if (c.pattern.test(name)) return c.name;
  return "Other Expenses";
}

function emptySection(): PnLSection {
  return {
    revenue: 0, cogs: 0, grossProfit: 0,
    opex: 0, opexByCategory: [],
    ebitda: 0, interest: 0, depreciation: 0,
    pbt: 0, tax: 0, net: 0,
  };
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Resolve a PnLPeriodKey to two date-range filters: primary + comparable. */
function resolvePeriodRanges(period: PnLPeriodKey): {
  primary:  { start: string; end: string; label: string };
  compare:  { start: string; end: string; label: string };
  ytd:      { start: string; end: string; label: string };
  fy: string;
} {
  const today  = new Date();
  const yyyy   = today.getFullYear();
  const month  = today.getMonth() + 1; // 1-indexed
  const fyStartYear = month >= 4 ? yyyy : yyyy - 1;
  const fy = `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

  const iso = (y: number, m: number, d: number) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const last = (y: number, m: number) => new Date(y, m, 0).getDate(); // last day of month m (1-indexed)
  const monthLabel = (m: number) => MONTH_LABELS[m - 1];

  // YTD always = FY-start → today
  const ytd = {
    start: iso(fyStartYear, 4, 1),
    end:   iso(yyyy, month, today.getDate()),
    label: `FY ${fy} YTD`,
  };

  // Helper: get quarter (1-4) within an FY. Q1 = Apr-Jun, Q2 = Jul-Sep, etc.
  const fyQuarter = (m: number): number => Math.floor(((m - 4 + 12) % 12) / 3) + 1;
  const qStartMonth = (q: number) => ((q - 1) * 3 + 4 - 1) % 12 + 1;       // Q1 → 4, Q2 → 7, Q3 → 10, Q4 → 1
  const qStartYear  = (q: number, fyStart: number) => q === 4 ? fyStart + 1 : fyStart;

  switch (period) {
    case "this_month": {
      const lastDay = last(yyyy, month);
      const prevDate  = new Date(yyyy, month - 2, 1);
      const pyyyy = prevDate.getFullYear(), pm = prevDate.getMonth() + 1;
      return {
        primary: { start: iso(yyyy, month, 1), end: iso(yyyy, month, lastDay),
                   label: `${monthLabel(month)} ${yyyy}` },
        compare: { start: iso(pyyyy, pm, 1), end: iso(pyyyy, pm, last(pyyyy, pm)),
                   label: `${monthLabel(pm)} ${pyyyy}` },
        ytd, fy,
      };
    }
    case "last_month": {
      const lm = new Date(yyyy, month - 2, 1);
      const lmY = lm.getFullYear(), lmM = lm.getMonth() + 1;
      const before = new Date(yyyy, month - 3, 1);
      const bY = before.getFullYear(), bM = before.getMonth() + 1;
      return {
        primary: { start: iso(lmY, lmM, 1), end: iso(lmY, lmM, last(lmY, lmM)), label: `${monthLabel(lmM)} ${lmY}` },
        compare: { start: iso(bY, bM, 1),   end: iso(bY, bM, last(bY, bM)),     label: `${monthLabel(bM)} ${bY}`  },
        ytd, fy,
      };
    }
    case "this_quarter": {
      const q   = fyQuarter(month);
      const sm  = qStartMonth(q);
      const sy  = qStartYear(q, fyStartYear);
      return {
        primary: { start: iso(sy, sm, 1), end: iso(yyyy, month, today.getDate()), label: `Q${q} FY${fy} (to date)` },
        compare: (() => {
          const pq = q === 1 ? 4 : q - 1;
          const pStartFY = q === 1 ? fyStartYear - 1 : fyStartYear;
          const psm = qStartMonth(pq);
          const psy = qStartYear(pq, pStartFY);
          // Last month of prev quarter
          const lastMonthOfQ = ((psm + 2 - 1) % 12) + 1;
          const lastYearOfQ = lastMonthOfQ < psm ? psy + 1 : psy;
          const prevFyLabel = `${pStartFY}-${String(pStartFY + 1).slice(2)}`;
          return {
            start: iso(psy, psm, 1),
            end: iso(lastYearOfQ, lastMonthOfQ, last(lastYearOfQ, lastMonthOfQ)),
            label: `Q${pq} FY${prevFyLabel}`,
          };
        })(),
        ytd, fy,
      };
    }
    case "last_quarter": {
      const curQ = fyQuarter(month);
      const lq   = curQ === 1 ? 4 : curQ - 1;
      const lqFyStart = curQ === 1 ? fyStartYear - 1 : fyStartYear;
      const lqSm = qStartMonth(lq);
      const lqSy = qStartYear(lq, lqFyStart);
      const lqLastM = ((lqSm + 2 - 1) % 12) + 1;
      const lqLastY = lqLastM < lqSm ? lqSy + 1 : lqSy;
      // Quarter before that
      const bq = lq === 1 ? 4 : lq - 1;
      const bqFyStart = lq === 1 ? lqFyStart - 1 : lqFyStart;
      const bqSm = qStartMonth(bq);
      const bqSy = qStartYear(bq, bqFyStart);
      const bqLastM = ((bqSm + 2 - 1) % 12) + 1;
      const bqLastY = bqLastM < bqSm ? bqSy + 1 : bqSy;
      const lqFyLabel = `${lqFyStart}-${String(lqFyStart + 1).slice(2)}`;
      const bqFyLabel = `${bqFyStart}-${String(bqFyStart + 1).slice(2)}`;
      return {
        primary: { start: iso(lqSy, lqSm, 1), end: iso(lqLastY, lqLastM, last(lqLastY, lqLastM)), label: `Q${lq} FY${lqFyLabel}` },
        compare: { start: iso(bqSy, bqSm, 1), end: iso(bqLastY, bqLastM, last(bqLastY, bqLastM)), label: `Q${bq} FY${bqFyLabel}` },
        ytd, fy,
      };
    }
    case "this_fy": {
      const prevFy = `${fyStartYear - 1}-${String(fyStartYear).slice(2)}`;
      return {
        primary: { start: iso(fyStartYear, 4, 1), end: iso(yyyy, month, today.getDate()), label: `FY ${fy} YTD` },
        compare: { start: iso(fyStartYear - 1, 4, 1), end: iso(fyStartYear, 3, 31), label: `FY ${prevFy} (full)` },
        ytd, fy,
      };
    }
    case "last_fy": {
      const lastFy = `${fyStartYear - 1}-${String(fyStartYear).slice(2)}`;
      const beforeFy = `${fyStartYear - 2}-${String(fyStartYear - 1).slice(2)}`;
      return {
        primary: { start: iso(fyStartYear - 1, 4, 1), end: iso(fyStartYear, 3, 31), label: `FY ${lastFy}` },
        compare: { start: iso(fyStartYear - 2, 4, 1), end: iso(fyStartYear - 1, 3, 31), label: `FY ${beforeFy}` },
        ytd, fy,
      };
    }
  }
}

export async function fetchPnL(
  supabase: SupabaseClient<Database>,
  companyId: string | null,
  period: PnLPeriodKey = "this_month",
): Promise<PnL> {
  const ranges = resolvePeriodRanges(period);
  const { primary: primaryRange, compare: compareRange, ytd: ytdRange, fy } = ranges;

  // Pre-load party names so we can exclude their Pymt/Jrnl movements from OpEx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let vQ = (supabase as any).from("vendors").select("name");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cQ = (supabase as any).from("customers").select("name");
  if (companyId) { vQ = vQ.eq("company_id", companyId); cQ = cQ.eq("company_id", companyId); }
  const [{ data: vendors }, { data: customers }] = await Promise.all([vQ, cQ]);
  const partyNames = new Set<string>();
  for (const v of (vendors ?? []) as Array<{ name: string }>)   partyNames.add(v.name.toLowerCase().trim());
  for (const c of (customers ?? []) as Array<{ name: string }>) partyNames.add(c.name.toLowerCase().trim());

  // Pull all transactions for the company (across FYs) — we filter by date in code
  type Txn = {
    transaction_date: string;
    voucher_type: string;
    ledger_name: string;
    amount: number;
    dr_cr: "DR" | "CR";
  };
  const txns: Txn[] = [];
  const PAGE = 1000;
  let from = 0;
  // Earliest date we need = min(compareRange.start, ytdRange.start)
  const minStart = compareRange.start < ytdRange.start ? compareRange.start : ytdRange.start;
  const maxEnd   = primaryRange.end > ytdRange.end ? primaryRange.end : ytdRange.end;
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from("transactions")
      .select("transaction_date, voucher_type, ledger_name, amount, dr_cr")
      .gte("transaction_date", minStart)
      .lte("transaction_date", maxEnd);
    if (companyId) q = q.eq("company_id", companyId);
    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    txns.push(...(data as Txn[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  function aggregate(filter: (t: Txn) => boolean): PnLSection {
    const s = emptySection();
    const catMap = new Map<string, number>();
    let revA = 0, revB = 0, cogsA = 0, cogsB = 0;

    for (const t of txns) {
      if (!filter(t)) continue;
      const amt = Number(t.amount);
      const sale = isSalesVoucher(t.voucher_type);
      const purc = isPurchaseVoucher(t.voucher_type);

      // Revenue
      if (sale && t.dr_cr === "CR" && isRevenueLedger(t.ledger_name)) revA += amt;
      if (sale && t.dr_cr === "DR" && !isTaxLedger(t.ledger_name) && !isRevenueLedger(t.ledger_name)) revB += amt;

      // COGS
      if (purc && t.dr_cr === "DR" && isCOGSLedger(t.ledger_name)) cogsA += amt;
      if (purc && t.dr_cr === "CR" && !isTaxLedger(t.ledger_name) && !isCOGSLedger(t.ledger_name)) cogsB += amt;

      // Specific expense buckets
      if (t.dr_cr === "DR" && isInterestLedger(t.ledger_name))     s.interest    += amt;
      if (t.dr_cr === "DR" && isDepreciationLedger(t.ledger_name)) s.depreciation += amt;

      // Tax net (output GST - input GST)
      if (isTaxLedger(t.ledger_name)) s.tax += t.dr_cr === "CR" ? amt : -amt;

      // OpEx: DR side of Jrnl / Journal vouchers to TRUE expense ledgers
      // (not a vendor/customer name, not COGS/Revenue/Interest/Depreciation/
      // Tax/Bank/Cash/Capital). Pymt vouchers are deliberately excluded —
      // they're AP settlements, not new expenses (DR vendor / CR bank).
      const vt = t.voucher_type.toLowerCase();
      if (
        t.dr_cr === "DR" &&
        (vt === "jrnl" || vt === "journal") &&
        !partyNames.has(t.ledger_name.toLowerCase().trim()) &&
        !isCOGSLedger(t.ledger_name)  && !isRevenueLedger(t.ledger_name) &&
        !isInterestLedger(t.ledger_name) && !isDepreciationLedger(t.ledger_name) &&
        !isTaxLedger(t.ledger_name)   && !isExclusionLedger(t.ledger_name)
      ) {
        const cat = categorise(t.ledger_name);
        catMap.set(cat, (catMap.get(cat) || 0) + amt);
      }
    }

    s.revenue = Math.max(revA, revB);
    s.cogs    = Math.max(cogsA, cogsB);
    s.grossProfit = s.revenue - s.cogs;
    s.opexByCategory = [...catMap.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);
    s.opex = s.opexByCategory.reduce((sum, c) => sum + c.amount, 0);
    s.ebitda = s.grossProfit - s.opex;
    s.pbt    = s.ebitda - s.interest - s.depreciation;
    s.net    = s.pbt - Math.max(0, s.tax);
    return s;
  }

  const inRange = (r: { start: string; end: string }) =>
    (t: Txn) => t.transaction_date >= r.start && t.transaction_date <= r.end;

  const primary = aggregate(inRange(primaryRange));
  const compare = aggregate(inRange(compareRange));
  const ytd     = aggregate(inRange(ytdRange));

  return {
    fy,
    primary,
    compare,
    ytd,
    primaryLabel: primaryRange.label,
    compareLabel: compareRange.label,
    ytdLabel: ytdRange.label,
    selectedPeriod: period,
  };
}
