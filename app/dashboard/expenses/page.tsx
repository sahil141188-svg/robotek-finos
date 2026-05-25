/**
 * Expense Tracker — Module 9
 *
 * Per-company (or consolidated) operating expense breakdown:
 *   - MTD total + MoM trend
 *   - Pie / list by category (Payroll, Rent, Utilities, ...)
 *   - Bar chart: last 6 months
 *   - Top vendors by spend
 *   - Recent transactions table
 *
 * Filters by selected company cookie. Empty companies show an empty state.
 */

import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { fetchExpenseSummary } from "@/lib/supabase/expenses-queries";
import { fmtAmt } from "@/lib/payables-data";
import { TrendingDown, TrendingUp, Wallet, Layers } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short",
  });
}

const CAT_COLORS = ["#E52D31", "#F7DA11", "#3b82f6", "#10b981", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#84cc16", "#1F1B20", "#852321", "#9A9596", "#0ea5e9"];

export default async function ExpensesPage() {
  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const summary   = await fetchExpenseSummary(supabase, companyId);

  const isEmpty   = summary.totalMTD === 0 && summary.byMonth.every(m => m.amount === 0);
  const scopeLabel = companyId ? "company" : "all companies";

  // Bar chart max for scaling
  const maxMonth = Math.max(1, ...summary.byMonth.map(m => m.amount));

  return (
    <>
      <Header
        title="Expense Tracker"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Expense Tracker" }]}
        showImport
        importModule="transactions"
      />

      <main className="flex-1 p-6 space-y-6 max-w-6xl">

        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            icon={<Wallet className="w-5 h-5 text-brand-red" />}
            label="Expenses MTD" value={fmtAmt(summary.totalMTD)}
            sub={`Across ${summary.byCategory.length} categories`}
          />
          <KpiTile
            icon={summary.monthOverMonthPct >= 0
              ? <TrendingUp className="w-5 h-5 text-red-600" />
              : <TrendingDown className="w-5 h-5 text-green-600" />}
            label="vs Last Month"
            value={`${summary.monthOverMonthPct >= 0 ? "+" : ""}${summary.monthOverMonthPct}%`}
            sub={`Prev: ${fmtAmt(summary.totalPrevMonth)}`}
            valueClass={summary.monthOverMonthPct > 0 ? "text-red-700" : "text-green-700"}
          />
          <KpiTile
            icon={<Layers className="w-5 h-5 text-amber-600" />}
            label="Largest Category"
            value={summary.byCategory[0]?.category ?? "—"}
            sub={summary.byCategory[0] ? `${fmtAmt(summary.byCategory[0].amount)} · ${summary.byCategory[0].pct}%` : ""}
          />
          <KpiTile
            icon={<Wallet className="w-5 h-5 text-blue-600" />}
            label="Top Vendor"
            value={summary.byVendor[0]?.vendor.slice(0, 22) ?? "—"}
            sub={summary.byVendor[0] ? fmtAmt(summary.byVendor[0].amount) : ""}
          />
        </div>

        {isEmpty && (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center">
            <p className="text-sm font-semibold text-brand-black">No expenses recorded for the selected {scopeLabel}.</p>
            <p className="text-xs text-brand-gray-mid mt-1">
              Import a Busy Day Book (with Jrnl / Pymt vouchers) to populate this view.
            </p>
          </div>
        )}

        {/* 6-month category × month matrix */}
        {!isEmpty && summary.categoryMatrix.rows.length > 0 && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Monthly comparison — last 6 months</h3>
              <p className="text-[11px] text-brand-gray-mid">
                Trend column flags spikes (&gt;50% above prior-month average)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-brand-gray-light/50 text-xs text-brand-gray-mid">
                    <th className="px-3 py-2.5 text-left font-medium sticky left-0 bg-brand-gray-light/50">Category</th>
                    {summary.categoryMatrix.monthHeaders.map((h) => (
                      <th key={h.key} className={`px-3 py-2.5 text-right font-medium whitespace-nowrap ${h.isCurrent ? "text-brand-red" : ""}`}>
                        {h.label}{h.isCurrent ? " ●" : ""}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right font-medium bg-brand-gray-light">6m Total</th>
                    <th className="px-3 py-2.5 text-left font-medium w-40">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.categoryMatrix.rows.map((r) => {
                    const trendChip =
                      r.trend === "spike" ? "bg-red-100 text-red-800 border-red-200" :
                      r.trend === "up"    ? "bg-amber-100 text-amber-800 border-amber-200" :
                      r.trend === "down"  ? "bg-blue-100 text-blue-800 border-blue-200" :
                      r.trend === "new"   ? "bg-purple-100 text-purple-800 border-purple-200" :
                      "bg-brand-gray-light text-brand-gray-mid border-border";
                    const trendIcon =
                      r.trend === "spike" ? "⚡" :
                      r.trend === "up"    ? "↑" :
                      r.trend === "down"  ? "↓" :
                      r.trend === "new"   ? "✨" : "→";
                    return (
                      <tr key={r.category} className="hover:bg-brand-gray-light/30">
                        <td className="px-3 py-2.5 font-medium text-brand-black sticky left-0 bg-white">{r.category}</td>
                        {r.cells.map((v, i) => {
                          const isCurrent = summary.categoryMatrix.monthHeaders[i].isCurrent;
                          return (
                            <td key={i} className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${v > 0 ? "text-brand-black" : "text-brand-gray-mid/40"} ${isCurrent ? "font-semibold" : ""}`}>
                              {v > 0 ? fmtAmt(v) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2.5 text-right font-bold tabular-nums whitespace-nowrap bg-brand-gray-light/40">{fmtAmt(r.total6m)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${trendChip}`}>
                            {trendIcon} {r.trendNote}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-brand-gray-light font-bold">
                    <td className="px-3 py-2.5 sticky left-0 bg-brand-gray-light">Total</td>
                    {summary.categoryMatrix.monthTotals.map((t, i) => (
                      <td key={i} className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">{t > 0 ? fmtAmt(t) : "—"}</td>
                    ))}
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap text-brand-red">{fmtAmt(summary.categoryMatrix.monthTotals.reduce((s, t) => s + t, 0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="px-5 py-2.5 bg-brand-gray-light/40 border-t border-border">
              <p className="text-[10px] text-brand-gray-mid leading-snug">
                ⚡ Spike = current month &gt;50% above prior-month average ·
                ↑ Up = +15-50% ·
                → Flat = ±15% ·
                ↓ Down = lower than usual ·
                ✨ New = first month with activity in this category.
                Click "Import" above to refresh after each Busy day-book export.
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown + Monthly trend */}
        {!isEmpty && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-brand-black mb-3">Spending by category — current month</h3>
              <div className="space-y-2.5">
                {summary.byCategory.slice(0, 12).map((c, i) => (
                  <div key={c.category} className="flex items-center gap-3 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                    <span className="flex-1 text-brand-black truncate">{c.category}</span>
                    <span className="text-brand-gray-mid w-24 text-right tabular-nums">{fmtAmt(c.amount)}</span>
                    <span className="text-brand-gray-mid w-12 text-right text-xs tabular-nums">{c.pct}%</span>
                  </div>
                ))}
                {summary.byCategory.length === 0 && (
                  <p className="text-xs text-brand-gray-mid">No expense transactions found in current month.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-brand-black mb-3">Monthly trend — last 6 months</h3>
              <div className="space-y-2.5">
                {summary.byMonth.map((m, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-12 text-xs text-brand-gray-mid shrink-0">{m.period.slice(0, 6)}</span>
                    <div className="flex-1 h-2 bg-brand-gray-light rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-brand-red" style={{ width: `${(m.amount / maxMonth) * 100}%` }} />
                    </div>
                    <span className="text-brand-black w-24 text-right tabular-nums text-xs">{fmtAmt(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Top vendors */}
        {summary.byVendor.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-3">Top vendors / payees — current month</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-brand-gray-mid">
                    <th className="px-2 py-2 font-medium">Vendor / Ledger</th>
                    <th className="px-2 py-2 font-medium text-right">Amount</th>
                    <th className="px-2 py-2 font-medium text-right w-16">% of total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.byVendor.map((v) => (
                    <tr key={v.vendor} className="hover:bg-brand-gray-light/40">
                      <td className="px-2 py-2.5 text-brand-black">{v.vendor}</td>
                      <td className="px-2 py-2.5 text-right font-medium tabular-nums">{fmtAmt(v.amount)}</td>
                      <td className="px-2 py-2.5 text-right text-brand-gray-mid tabular-nums">{v.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent expense transactions */}
        {summary.recentTxns.length > 0 && (
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black">Recent expense transactions</h3>
              <span className="text-xs text-brand-gray-mid">latest {summary.recentTxns.length}</span>
            </div>
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-brand-gray-light/95">
                  <tr className="text-left text-xs text-brand-gray-mid border-b border-border">
                    <th className="px-3 py-2 font-medium w-20">Date</th>
                    <th className="px-3 py-2 font-medium w-20">Vch No</th>
                    <th className="px-3 py-2 font-medium">Ledger</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {summary.recentTxns.map((t, i) => (
                    <tr key={i} className="hover:bg-brand-gray-light/40">
                      <td className="px-3 py-2 text-xs text-brand-gray-mid">{fmtDate(t.date)}</td>
                      <td className="px-3 py-2 text-xs font-mono text-brand-gray-mid">{t.voucher_number ?? "—"}</td>
                      <td className="px-3 py-2 text-brand-black">{t.ledger_name}</td>
                      <td className="px-3 py-2 text-xs text-brand-gray-mid">{t.category}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtAmt(t.amount)}</td>
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
