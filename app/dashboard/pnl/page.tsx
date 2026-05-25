/**
 * Profit & Loss Statement — Module 10
 *
 * Indian-format P&L: Revenue → COGS → Gross Profit → OpEx → EBITDA →
 * Interest → Depreciation → PBT → Tax → Net Profit. Side-by-side columns
 * for current month / previous month / YTD.
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { fetchPnL, type PnLSection } from "@/lib/supabase/pnl-queries";
import { fmtAmt } from "@/lib/payables-data";
import { ScrollText } from "lucide-react";

export const dynamic = "force-dynamic";

function pctMargin(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default async function PnLPage() {
  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const pnl       = await fetchPnL(supabase, companyId);

  const isEmpty = pnl.ytd.revenue === 0 && pnl.ytd.cogs === 0 && pnl.ytd.opex === 0;

  return (
    <>
      <Header
        title="Profit & Loss Statement"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "P&L Statement" }]}
        showImport
        importModule="transactions"
      />

      <main className="flex-1 p-6 space-y-5 max-w-5xl">
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-red/10 flex items-center justify-center">
              <ScrollText className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <h2 className="text-base font-bold text-brand-black">P&L — FY {pnl.fy}</h2>
              <p className="text-xs text-brand-gray-mid">
                {companyId ? "Selected company" : "All companies (consolidated)"} ·
                Indian format, rupees converted on the fly
              </p>
            </div>
          </div>

          {isEmpty ? (
            <div className="bg-brand-gray-light rounded-lg p-6 text-center">
              <p className="text-sm font-semibold text-brand-black">No P&L data for this scope yet.</p>
              <p className="text-xs text-brand-gray-mid mt-1">
                Import a Busy Day Book (Sales + Purchase + Journal vouchers) to populate.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-brand-gray-mid">
                    <th className="px-3 py-2 text-left font-medium">Line item</th>
                    <th className="px-3 py-2 text-right font-medium w-32">{pnl.currentLabel}</th>
                    <th className="px-3 py-2 text-right font-medium w-32">{pnl.previousLabel}</th>
                    <th className="px-3 py-2 text-right font-medium w-32">{pnl.ytdLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Row label="Revenue" cur={pnl.currentMonth.revenue} prev={pnl.previousMonth.revenue} ytd={pnl.ytd.revenue} bold />
                  <Row label="Less: Cost of Goods Sold (COGS)" cur={pnl.currentMonth.cogs} prev={pnl.previousMonth.cogs} ytd={pnl.ytd.cogs} negative />
                  <Row label="Gross Profit" cur={pnl.currentMonth.grossProfit} prev={pnl.previousMonth.grossProfit} ytd={pnl.ytd.grossProfit} bold
                       subtitle={`GP margin: ${pctMargin(pnl.ytd.grossProfit, pnl.ytd.revenue)}`} />

                  {/* Operating expense detail */}
                  <tr><td colSpan={4} className="pt-3 pb-1 px-3 text-xs uppercase tracking-wider text-brand-gray-mid">Operating Expenses</td></tr>
                  {pnl.currentMonth.opexByCategory.length > 0
                    ? pnl.currentMonth.opexByCategory.map((cat) => {
                        const prevAmt = pnl.previousMonth.opexByCategory.find((c) => c.category === cat.category)?.amount ?? 0;
                        const ytdAmt  = pnl.ytd.opexByCategory.find((c) => c.category === cat.category)?.amount ?? 0;
                        return <Row key={cat.category} label={cat.category} cur={cat.amount} prev={prevAmt} ytd={ytdAmt} indent />;
                      })
                    : <tr><td colSpan={4} className="px-6 py-2 text-xs text-brand-gray-mid italic">No operating expense entries</td></tr>
                  }
                  <Row label="Total OpEx" cur={pnl.currentMonth.opex} prev={pnl.previousMonth.opex} ytd={pnl.ytd.opex} negative subtle />

                  <Row label="EBITDA" cur={pnl.currentMonth.ebitda} prev={pnl.previousMonth.ebitda} ytd={pnl.ytd.ebitda} bold
                       subtitle={`EBITDA margin: ${pctMargin(pnl.ytd.ebitda, pnl.ytd.revenue)}`} />

                  {(pnl.ytd.depreciation > 0 || pnl.ytd.interest > 0) && (
                    <>
                      {pnl.ytd.depreciation > 0 && <Row label="Less: Depreciation / Amortization" cur={pnl.currentMonth.depreciation} prev={pnl.previousMonth.depreciation} ytd={pnl.ytd.depreciation} negative />}
                      {pnl.ytd.interest > 0 && <Row label="Less: Interest Expense" cur={pnl.currentMonth.interest} prev={pnl.previousMonth.interest} ytd={pnl.ytd.interest} negative />}
                    </>
                  )}

                  <Row label="Profit Before Tax (PBT)" cur={pnl.currentMonth.pbt} prev={pnl.previousMonth.pbt} ytd={pnl.ytd.pbt} bold />
                  <Row label="Less: Net Tax (output GST − input GST + TDS)"
                       cur={pnl.currentMonth.tax} prev={pnl.previousMonth.tax} ytd={pnl.ytd.tax} negative />

                  <Row label="Net Profit / (Loss)" cur={pnl.currentMonth.net} prev={pnl.previousMonth.net} ytd={pnl.ytd.net} bold
                       subtitle={`Net margin: ${pctMargin(pnl.ytd.net, pnl.ytd.revenue)}`} />
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-brand-gray-mid leading-snug">
            Notes: Revenue and COGS are taken net of GST where Day Book contras
            (e.g. "Sale GST", "Purchase") are available; otherwise gross invoice
            value is used. EBITDA = Gross Profit − Total OpEx. Net Tax = output
            GST minus input GST credit plus TDS deposits. This is a management
            view, not an audited statement — reconcile to Busy for filing.
          </p>
        </div>
      </main>
    </>
  );
}

function Row({ label, cur, prev, ytd, bold, negative, indent, subtle, subtitle }: {
  label: string;
  cur: number; prev: number; ytd: number;
  bold?: boolean; negative?: boolean; indent?: boolean; subtle?: boolean;
  subtitle?: string;
}) {
  const fmt = (n: number) => {
    if (n === 0 && !bold) return "—";
    const sign = negative && n > 0 ? "−" : (n < 0 ? "−" : "");
    return `${sign}${fmtAmt(Math.abs(n))}`;
  };
  const className = [
    bold ? "font-bold text-brand-black bg-brand-gray-light/40" :
    subtle ? "font-semibold text-brand-gray-mid bg-brand-gray-light/20" :
    "text-brand-black",
  ].join(" ");
  return (
    <tr className={className}>
      <td className={`px-3 py-2 ${indent ? "pl-8 text-xs text-brand-gray-mid" : ""}`}>
        {label}
        {subtitle && <span className="ml-2 text-[10px] font-normal text-brand-gray-mid">· {subtitle}</span>}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(cur)}</td>
      <td className="px-3 py-2 text-right tabular-nums text-brand-gray-mid">{fmt(prev)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(ytd)}</td>
    </tr>
  );
}

// Suppress unused type import warning
export type _PnLSection = PnLSection;
