/**
 * Cash Flow Statement — Module 11
 *
 * Inflows / outflows from bank_statements classified into Operating /
 * Investing / Financing. Weekly + monthly trends. Per-bank closing balances.
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { fetchCashFlow } from "@/lib/supabase/cashflow-queries";
import { fmtAmt } from "@/lib/payables-data";
import { ArrowDownLeft, ArrowUpRight, Banknote, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const CLASS_BADGES: Record<string, { label: string; className: string }> = {
  operating: { label: "Operating",  className: "bg-blue-100 text-blue-800 border-blue-200" },
  investing: { label: "Investing",  className: "bg-purple-100 text-purple-800 border-purple-200" },
  financing: { label: "Financing",  className: "bg-amber-100 text-amber-800 border-amber-200" },
};

export default async function CashFlowPage() {
  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const cf        = await fetchCashFlow(supabase, companyId);

  const maxWeek = Math.max(1, ...cf.weeklyTrend.map((w) => Math.max(w.inflow, w.outflow)));
  const maxMonth = Math.max(1, ...cf.monthlyTrend.map((m) => Math.max(m.inflow, m.outflow)));

  return (
    <>
      <Header
        title="Cash Flow Statement"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Cash Flow" }]}
        showImport
        importModule="bank_statement"
      />

      <main className="flex-1 p-6 space-y-5 max-w-6xl">
        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={<ArrowDownLeft className="w-5 h-5 text-green-600" />}
            label="Total Inflow" value={fmtAmt(cf.totalInflow)} sub="Across all bank accounts" />
          <KpiTile icon={<ArrowUpRight className="w-5 h-5 text-red-600" />}
            label="Total Outflow" value={fmtAmt(cf.totalOutflow)} sub="Across all bank accounts"
            valueClass="text-red-700" />
          <KpiTile icon={<Activity className="w-5 h-5 text-blue-600" />}
            label="Net Cash Flow" value={fmtAmt(cf.netCashFlow)}
            sub={cf.netCashFlow >= 0 ? "Surplus" : "Deficit"}
            valueClass={cf.netCashFlow >= 0 ? "text-green-700" : "text-red-700"} />
          <KpiTile icon={<Banknote className="w-5 h-5 text-amber-600" />}
            label="Bank accounts"
            value={`${cf.accountBalances.length}`}
            sub={`Combined: ${fmtAmt(cf.accountBalances.reduce((s, a) => s + a.closing, 0))}`} />
        </div>

        {/* Classification (Indian Accounting Standard pattern) */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-3">
          <h3 className="text-sm font-semibold text-brand-black">Cash flow by activity</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-brand-gray-mid">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">Activity</th>
                  <th className="px-3 py-2 text-right font-medium">Inflow</th>
                  <th className="px-3 py-2 text-right font-medium">Outflow</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(["operating", "investing", "financing"] as const).map((k) => {
                  const s = cf.byClass[k];
                  return (
                    <tr key={k}>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CLASS_BADGES[k].className}`}>{CLASS_BADGES[k].label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-green-700 tabular-nums">{fmtAmt(s.inflow)}</td>
                      <td className="px-3 py-2.5 text-right text-red-700 tabular-nums">{fmtAmt(s.outflow)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${s.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {s.net >= 0 ? "+" : "−"}{fmtAmt(Math.abs(s.net))}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-brand-gray-light/40 font-bold">
                  <td className="px-3 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right text-green-700 tabular-nums">{fmtAmt(cf.totalInflow)}</td>
                  <td className="px-3 py-2.5 text-right text-red-700 tabular-nums">{fmtAmt(cf.totalOutflow)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums ${cf.netCashFlow >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {cf.netCashFlow >= 0 ? "+" : "−"}{fmtAmt(Math.abs(cf.netCashFlow))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-brand-gray-mid leading-snug">
            Classification is heuristic-based on transaction description keywords.
            "Operating" = customer/vendor/salary/tax flows; "Investing" = FD,
            shares, capex, sweep transfers; "Financing" = loans, interest,
            dividend, capital. Rebucket manually in the description if needed.
          </p>
        </div>

        {/* Weekly + Monthly trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TrendCard title="Last 8 weeks" rows={cf.weeklyTrend.map((w) => ({ label: w.weekLabel, inflow: w.inflow, outflow: w.outflow, net: w.net }))} max={maxWeek} />
          <TrendCard title="Last 6 months" rows={cf.monthlyTrend.map((m) => ({ label: m.period.slice(0, 8), inflow: m.inflow, outflow: m.outflow, net: m.net }))} max={maxMonth} />
        </div>

        {/* Bank account closing balances */}
        {cf.accountBalances.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-3">Account balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cf.accountBalances.map((a, i) => (
                <div key={i} className="border border-border rounded-lg p-3 space-y-1">
                  <p className="text-xs font-medium text-brand-black">{a.bank}</p>
                  <p className="text-[10px] text-brand-gray-mid">{a.account} · {a.type}</p>
                  <p className={`text-lg font-bold tabular-nums ${a.closing < 0 ? "text-red-700" : "text-brand-black"}`}>{fmtAmt(a.closing)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        {cf.recentTransactions.length > 0 && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Recent cash transactions</h3>
              <span className="text-xs text-brand-gray-mid">latest {cf.recentTransactions.length}</span>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-brand-gray-light/95">
                  <tr className="text-left text-xs text-brand-gray-mid border-b border-border">
                    <th className="px-3 py-2 font-medium w-20">Date</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                    <th className="px-3 py-2 font-medium w-28">Bank</th>
                    <th className="px-3 py-2 font-medium">Activity</th>
                    <th className="px-3 py-2 font-medium text-right w-24">Debit</th>
                    <th className="px-3 py-2 font-medium text-right w-24">Credit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cf.recentTransactions.map((t, i) => (
                    <tr key={i} className="hover:bg-brand-gray-light/40">
                      <td className="px-3 py-2 text-xs text-brand-gray-mid whitespace-nowrap">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2 text-xs text-brand-black truncate max-w-md">{t.description}</td>
                      <td className="px-3 py-2 text-xs text-brand-gray-mid whitespace-nowrap">{t.bank}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${CLASS_BADGES[t.class].className}`}>{CLASS_BADGES[t.class].label}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-red-700 tabular-nums">{t.debit > 0 ? fmtAmt(t.debit) : "—"}</td>
                      <td className="px-3 py-2 text-right text-green-700 tabular-nums">{t.credit > 0 ? fmtAmt(t.credit) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function KpiTile({ icon, label, value, sub, valueClass = "text-brand-black" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 space-y-2">
      <div className="flex items-center gap-2">{icon}<p className="text-xs font-medium text-brand-gray-mid">{label}</p></div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid truncate">{sub}</p>
    </div>
  );
}

function TrendCard({ title, rows, max }: {
  title: string;
  rows: Array<{ label: string; inflow: number; outflow: number; net: number }>;
  max: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-brand-black mb-3">{title}</h3>
      <div className="space-y-2.5">
        {rows.length === 0 && <p className="text-xs text-brand-gray-mid">No data yet.</p>}
        {rows.map((r, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex items-center text-xs">
              <span className="w-20 text-brand-gray-mid shrink-0">{r.label}</span>
              <span className={`ml-auto font-semibold tabular-nums ${r.net >= 0 ? "text-green-700" : "text-red-700"}`}>
                {r.net >= 0 ? "+" : "−"}{fmtAmt(Math.abs(r.net))}
              </span>
            </div>
            <div className="flex gap-1 items-center">
              <div className="flex-1 h-1.5 bg-brand-gray-light rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${(r.inflow / max) * 100}%` }} />
              </div>
              <div className="flex-1 h-1.5 bg-brand-gray-light rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${(r.outflow / max) * 100}%` }} />
              </div>
            </div>
            <div className="flex gap-1 text-[10px] text-brand-gray-mid tabular-nums">
              <span className="flex-1">↓ {fmtAmt(r.inflow)}</span>
              <span className="flex-1 text-right">↑ {fmtAmt(r.outflow)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
