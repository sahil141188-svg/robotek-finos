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

export type PnL = {
  fy: string;
  currentMonth:  PnLSection;
  previousMonth: PnLSection;
  ytd:           PnLSection;
  currentLabel: string;
  previousLabel: string;
  ytdLabel: string;
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

export async function fetchPnL(
  supabase: SupabaseClient<Database>,
  companyId: string | null,
): Promise<PnL> {
  const today = new Date();
  const curM   = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const prevD  = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const prevM  = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, "0")}`;

  // FY runs Apr-Mar
  const fyStartYear = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  const fy = `${fyStartYear}-${String(fyStartYear + 1).slice(2)}`;

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

  // Pull all transactions in current FY
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
  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any).from("transactions")
      .select("transaction_date, voucher_type, ledger_name, amount, dr_cr")
      .eq("financial_year", fy);
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

  const currentMonth  = aggregate((t) => t.transaction_date.startsWith(curM));
  const previousMonth = aggregate((t) => t.transaction_date.startsWith(prevM));
  const ytd           = aggregate(() => true);

  return {
    fy,
    currentMonth,
    previousMonth,
    ytd,
    currentLabel: `${MONTH_LABELS[today.getMonth()]} ${today.getFullYear()}`,
    previousLabel: `${MONTH_LABELS[prevD.getMonth()]} ${prevD.getFullYear()}`,
    ytdLabel: `FY ${fy} YTD`,
  };
}
