/**
 * Profit & Loss Statement — Module 10
 *
 * Indian-format P&L with period selector:
 *   This Month / Last Month / This Quarter / Last Quarter / This FY / Last FY
 * Three columns: selected period | comparable previous | YTD.
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { fetchPnL, type PnLSection, type PnLPeriodKey } from "@/lib/supabase/pnl-queries";
import { fmtAmt } from "@/lib/payables-data";
import { ScrollText } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

function pctMargin(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

const PERIOD_OPTIONS: Array<{ key: PnLPeriodKey; label: string }> = [
  { key: "this_month",   label: "This Month" },
  { key: "last_month",   label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "last_quarter", label: "Last Quarter" },
  { key: "this_fy",      label: "This FY" },
  { key: "last_fy",      label: "Last FY" },
];

export default async function PnLPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp     = await searchParams;
  const period = (PERIOD_OPTIONS.find((p) => p.key === sp.period)?.key ?? "this_month") as PnLPeriodKey;

  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const pnl       = await fetchPnL(supabase, companyId, period);

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
          <div className="flex items-start justify-between gap-4 flex-wrap">
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
            {/* Period selector — links re-render with ?period=... */}
            <div className="flex items-center gap-1 flex-wrap">
              {PERIOD_OPTIONS.map((opt) => (
                <Link
                  key={opt.key}
                  href={`/dashboard/pnl?period=${opt.key}`}
                  scroll={false}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    pnl.selectedPeriod === opt.key
                      ? "bg-brand-red text-white border-brand-red"
                      : "bg-white text-brand-gray-mid border-border hover:bg-brand-gray-light"
                  }`}
                >
                  {opt.label}
                </Link>
              ))}
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
                    <th className="px-3 py-2 text-right font-medium w-36">{pnl.primaryLabel}</th>
                    <th className="px-3 py-2 text-right font-medium w-36">{pnl.compareLabel}</th>
                    <th className="px-3 py-2 text-right font-medium w-32">{pnl.ytdLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Row label="Revenue" cur={pnl.primary.revenue} prev={pnl.compare.revenue} ytd={pnl.ytd.revenue} bold />
                  <Row label="Less: Cost of Goods Sold (COGS)" cur={pnl.primary.cogs} prev={pnl.compare.cogs} ytd={pnl.ytd.cogs} negative />
                  <Row label="Gross Profit" cur={pnl.primary.grossProfit} prev={pnl.compare.grossProfit} ytd={pnl.ytd.grossProfit} bold
                       subtitle={`GP margin: ${pctMargin(pnl.ytd.grossProfit, pnl.ytd.revenue)}`} />

                  {/* Operating expense detail */}
                  <tr><td colSpan={4} className="pt-3 pb-1 px-3 text-xs uppercase tracking-wider text-brand-gray-mid">Operating Expenses</td></tr>
                  {pnl.primary.opexByCategory.length > 0
                    ? pnl.primary.opexByCategory.map((cat) => {
                        const prevAmt = pnl.compare.opexByCategory.find((c) => c.category === cat.category)?.amount ?? 0;
                        const ytdAmt  = pnl.ytd.opexByCategory.find((c) => c.category === cat.category)?.amount ?? 0;
                        return <Row key={cat.category} label={cat.category} cur={cat.amount} prev={prevAmt} ytd={ytdAmt} indent />;
                      })
                    : <tr><td colSpan={4} className="px-6 py-2 text-xs text-brand-gray-mid italic">No operating expense entries</td></tr>
                  }
                  <Row label="Total OpEx" cur={pnl.primary.opex} prev={pnl.compare.opex} ytd={pnl.ytd.opex} negative subtle />

                  <Row label="EBITDA" cur={pnl.primary.ebitda} prev={pnl.compare.ebitda} ytd={pnl.ytd.ebitda} bold
                       subtitle={`EBITDA margin: ${pctMargin(pnl.ytd.ebitda, pnl.ytd.revenue)}`} />

                  {(pnl.ytd.depreciation > 0 || pnl.ytd.interest > 0) && (
                    <>
                      {pnl.ytd.depreciation > 0 && <Row label="Less: Depreciation / Amortization" cur={pnl.primary.depreciation} prev={pnl.compare.depreciation} ytd={pnl.ytd.depreciation} negative />}
                      {pnl.ytd.interest > 0 && <Row label="Less: Interest Expense" cur={pnl.primary.interest} prev={pnl.compare.interest} ytd={pnl.ytd.interest} negative />}
                    </>
                  )}

                  <Row label="Profit Before Tax (PBT)" cur={pnl.primary.pbt} prev={pnl.compare.pbt} ytd={pnl.ytd.pbt} bold />
                  <Row label="Less: Net Tax (output GST − input GST + TDS)"
                       cur={pnl.primary.tax} prev={pnl.compare.tax} ytd={pnl.ytd.tax} negative />

                  <Row label="Net Profit / (Loss)" cur={pnl.primary.net} prev={pnl.compare.net} ytd={pnl.ytd.net} bold
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
  const pctChange = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : 0;
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
      <td className="px-3 py-2 text-right tabular-nums">
        {fmt(cur)}
        {bold && prev > 0 && (
          <span className={`ml-1 text-[10px] font-normal ${pctChange >= 0 ? "text-green-700" : "text-red-700"}`}>
            ({pctChange >= 0 ? "+" : ""}{pctChange}%)
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-brand-gray-mid">{fmt(prev)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(ytd)}</td>
    </tr>
  );
}

// Suppress unused type import warning
export type _PnLSection = PnLSection;
