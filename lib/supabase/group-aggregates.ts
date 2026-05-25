/**
 * group-aggregates — compute live per-company KPIs for the consolidated dashboard.
 *
 * For each company, returns:
 *   - Revenue MTD (current month) — sum of sales voucher amounts
 *   - Net P&L MTD (Revenue − COGS − OpEx − Tax)
 *   - AP Outstanding (via FIFO aging)
 *   - AR Outstanding (via FIFO aging)
 *   - Cash Balance (sum of bank_accounts.closing_balance, paisa→rupees)
 *   - Compliance score (left as seeded value for now)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { buildPartyAging } from "./party-aging";

export type GroupRow = {
  id: string;
  name: string;
  short_name: string;
  type: string;
  city: string;
  color_class: string;
  status: "active" | "dormant";
  monthly_revenue: number;
  ap_outstanding: number;
  ar_outstanding: number;
  cash_balance: number;
  net_pl_monthly: number;
  compliance_score: number;
  employee_count: number;
  sort_order: number;
};

/** Match Busy's voucher type to a sale (SupO / Sales / SaleReturn) */
function isSalesVoucher(v: string): boolean {
  const s = v.toLowerCase();
  return s === "supo" || s === "sales" || s === "sale" || s === "sirt";
}
/** Match Busy's voucher type to a purchase (SupI / Purchase) */
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
function isTaxLedger(name: string): boolean {
  return /\b(cgst|sgst|igst|gst|tds|tcs|advance tax|custom duty|tax payable)\b/i.test(name);
}

function getCurrentMonthPrefix(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Fetch live KPI aggregates for every active company and return them merged
 * with the static company metadata (name/colour/etc.) from `companies`.
 */
export async function fetchGroupAggregates(
  supabase: SupabaseClient<Database>,
): Promise<GroupRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: companies } = await (supabase as any)
    .from("companies").select("*").order("sort_order");
  if (!companies || companies.length === 0) return [];

  const currentMonth = getCurrentMonthPrefix();
  const rows: GroupRow[] = [];

  for (const c of companies) {
    let revenue = 0, cogs = 0, opex = 0, taxNet = 0, cash = 0;
    let ap = 0, ar = 0;

    if (c.status === "active") {
      // ── Pull transactions for THIS company, paginated ───────────────────
      type Txn = { voucher_type: string; ledger_name: string; amount: number; dr_cr: "DR" | "CR"; transaction_date: string };
      const txns: Txn[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("transactions")
          .select("voucher_type, ledger_name, amount, dr_cr, transaction_date")
          .eq("company_id", c.id)
          .range(from, from + PAGE - 1);
        if (error) break;
        if (!data || data.length === 0) break;
        txns.push(...(data as Txn[]));
        if (data.length < PAGE) break;
        from += PAGE;
      }

      // ── Revenue / COGS / OpEx / Tax for current month ───────────────────
      let revA = 0, revB = 0, cogsA = 0, cogsB = 0;
      for (const t of txns) {
        if (!t.transaction_date.startsWith(currentMonth)) continue;
        const amt = Number(t.amount);
        const isSale = isSalesVoucher(t.voucher_type);
        const isPurc = isPurchaseVoucher(t.voucher_type);

        if (isSale && t.dr_cr === "CR" && isRevenueLedger(t.ledger_name)) revA += amt;
        if (isSale && t.dr_cr === "DR" && !isTaxLedger(t.ledger_name) && !isRevenueLedger(t.ledger_name)) revB += amt;
        if (isPurc && t.dr_cr === "DR" && isCOGSLedger(t.ledger_name)) cogsA += amt;
        if (isPurc && t.dr_cr === "CR" && !isTaxLedger(t.ledger_name) && !isCOGSLedger(t.ledger_name)) cogsB += amt;

        if (isTaxLedger(t.ledger_name)) taxNet += t.dr_cr === "CR" ? amt : -amt;
        else if (
          t.dr_cr === "DR" &&
          (t.voucher_type.toLowerCase() === "jrnl" || t.voucher_type.toLowerCase() === "journal") &&
          !isCOGSLedger(t.ledger_name) && !isRevenueLedger(t.ledger_name)
        ) opex += amt;
      }
      revenue = Math.max(revA, revB);
      cogs = Math.max(cogsA, cogsB);

      // ── Cash: sum bank_accounts.closing_balance (paisa) ─────────────────
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: ba } = await (supabase as any)
          .from("bank_accounts").select("closing_balance").eq("company_id", c.id);
        if (ba) cash = ba.reduce((s: number, b: { closing_balance: number }) => s + Number(b.closing_balance) / 100, 0);
      } catch { /* ignore */ }

      // ── AP / AR via shared aging engine ─────────────────────────────────
      try {
        const [apData, arData] = await Promise.all([
          buildPartyAging(supabase, "vendor", c.id),
          buildPartyAging(supabase, "customer", c.id),
        ]);
        ap = apData.summary.total;
        ar = arData.summary.total;
      } catch { /* ignore */ }
    }

    const netPL = revenue - cogs - opex - Math.max(0, taxNet);

    rows.push({
      id: c.id,
      name: c.name,
      short_name: c.short_name,
      type: c.type ?? "",
      city: c.city ?? "",
      color_class: c.color_class ?? "bg-brand-red",
      status: c.status,
      monthly_revenue: revenue,
      ap_outstanding: ap,
      ar_outstanding: ar,
      cash_balance: cash,
      net_pl_monthly: netPL,
      compliance_score: c.compliance_score ?? 0,
      employee_count: c.employee_count ?? 0,
      sort_order: c.sort_order ?? 0,
    });
  }

  return rows;
}
