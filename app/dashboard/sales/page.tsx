/**
 * AI Sales Coordinator — Module 9 overview.
 *
 * Server component. Surfaces:
 *   • KPI tiles (customers, breakeven items, this-month target, overdue)
 *   • Churn Radar — customers overdue vs their own reorder rhythm (clickable)
 *   • Seasonal demand curve
 *   • Breakeven target board — items + their seasonal monthly target
 *
 * RULE 1/2: every customer row links to its drill-down page.
 * RULE 5: Indian number format. Data is historical until the live tab syncs.
 */
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getSalesOverview } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { SeasonalChart } from "@/components/sales/seasonal-chart";
import { WhatsAppButton } from "@/components/sales/whatsapp-button";
import { churnNudge, waLink } from "@/lib/sales/whatsapp-templates";
import { Users, Target, TrendingUp, AlertTriangle, ChevronRight, Info, Star } from "lucide-react";

export const dynamic = "force-dynamic";

const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function SalesPage() {
  const supabase = await createClient();
  const { kpis, churn, breakevenItems } = await getSalesOverview(supabase);

  return (
    <>
      <Header
        title="AI Sales Coordinator"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Sales Coordinator" }]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6 max-w-6xl">
        {/* Historical-data notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            Showing <strong>historical</strong> order data. Churn Radar is computed as of the latest order in the data
            ({fmtDate(kpis.asOf)}). Connect the live order tab to make this real-time and fill the May/Jun gap.
          </p>
        </div>

        {/* ── KPI tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={<Users className="w-5 h-5 text-blue-600" />} label="Customers" value={`${kpis.customerCount}`} sub={`${kpis.focusTargetCount} focus targets`} className="bg-blue-50 border-blue-200" />
          <KpiTile icon={<Target className="w-5 h-5 text-brand-red" />} label="Breakeven Items" value={`${kpis.breakevenItemCount}`} sub="must-hit monthly" className="bg-white border-border" />
          <KpiTile
            icon={<TrendingUp className="w-5 h-5 text-green-600" />}
            label={`${MONTHS[kpis.currentMonth]} Target`}
            value={`${formatQty(kpis.thisMonthTarget)}`}
            sub={kpis.provisionalMonth ? "units (seasonal est.)" : "units (seasonal)"}
            className="bg-green-50 border-green-200"
          />
          <KpiTile icon={<AlertTriangle className="w-5 h-5 text-red-600" />} label="Overdue Now" value={`${kpis.overdueCount}`} sub="≥1.5× their gap" className="bg-red-50 border-red-200" valueClass="text-red-700" />
        </div>

        {/* ── Churn Radar ── */}
        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-brand-black">Churn Radar</h3>
              <p className="text-xs text-brand-gray-mid mt-0.5">Customers overdue vs their own reorder rhythm — contact these first</p>
            </div>
            <AlertTriangle className="w-4 h-4 text-brand-gray-mid" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                  <th className="text-left font-medium px-5 py-2.5">Customer</th>
                  <th className="text-right font-medium px-3 py-2.5">Orders</th>
                  <th className="text-right font-medium px-3 py-2.5">Avg gap</th>
                  <th className="text-right font-medium px-3 py-2.5">Days since</th>
                  <th className="text-right font-medium px-3 py-2.5">Overdue</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {churn.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-xs text-brand-gray-mid">No churn signal yet.</td></tr>
                )}
                {churn.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/sales/${r.id}`} className="font-medium text-brand-black hover:text-brand-red">
                        {r.name}
                      </Link>
                      {r.segment && <span className="ml-2 text-[10px] uppercase tracking-wide text-brand-gray-mid">{r.segment}</span>}
                    </td>
                    <td className="px-3 py-3 text-right text-brand-gray-mid">{r.totalOrders}</td>
                    <td className="px-3 py-3 text-right text-brand-gray-mid">{r.avgGapDays}d</td>
                    <td className="px-3 py-3 text-right text-brand-gray-mid">{r.daysSince}d</td>
                    <td className="px-3 py-3 text-right">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${r.overdueRatio >= 3 ? "bg-red-100 text-red-700" : r.overdueRatio >= 1.5 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                        {r.overdueRatio}×
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <WhatsAppButton href={waLink(churnNudge(r.name), r.phone)} iconOnly size="sm" label={`WhatsApp ${r.name}`} />
                        <Link href={`/dashboard/sales/${r.id}`} className="text-brand-gray-mid hover:text-brand-red inline-flex" aria-label="Open customer">
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Seasonal curve ── */}
        <section className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-brand-black mb-1">Demand Seasonality</h3>
          <p className="text-xs text-brand-gray-mid mb-3">
            Multiplier vs an average month — every target auto-scales by this. Yellow = current month, grey = estimate (no data yet).
          </p>
          <SeasonalChart currentMonth={kpis.currentMonth} />
        </section>

        {/* ── Breakeven target board ── */}
        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-brand-black">Breakeven Targets — top items</h3>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Monthly baseline (history +10%) and this month&apos;s seasonal goal, ordered by value. <Star className="inline w-3 h-3 text-brand-yellow fill-brand-yellow" /> = high-value, push first.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                  <th className="text-left font-medium px-5 py-2.5">Item</th>
                  <th className="text-right font-medium px-3 py-2.5">Monthly baseline</th>
                  <th className="text-right font-medium px-5 py-2.5">{MONTHS[kpis.currentMonth]} goal</th>
                </tr>
              </thead>
              <tbody>
                {breakevenItems.map((it) => (
                  <tr key={it.id} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-brand-black">
                      {it.highValue && <Star className="inline w-3.5 h-3.5 mr-1.5 text-brand-yellow fill-brand-yellow align-text-bottom" />}
                      {it.name}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{formatQty(it.monthlyTarget)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-brand-black">{formatQty(it.thisMonthTarget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}

function KpiTile({ icon, label, value, sub, className, valueClass = "text-brand-black" }: {
  icon: React.ReactNode; label: string; value: string; sub: string; className?: string; valueClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-medium text-brand-gray-mid">{label}</p>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid">{sub}</p>
    </div>
  );
}
