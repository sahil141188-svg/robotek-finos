/**
 * CRR — Category Targets. Monthly targets rolled up by product series/category.
 */
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTargets } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { Star, Layers } from "lucide-react";

export const dynamic = "force-dynamic";
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function CategoryTargetsPage() {
  const supabase = await createClient();
  const { rows, totalMonthly, currentMonth } = await getCategoryTargets(supabase);

  return (
    <>
      <Header
        title="Category Targets"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "CRR", href: "/dashboard/sales" }, { label: "Category Targets" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6 max-w-6xl">
        <div className="rounded-xl border border-border bg-white p-4 flex items-center gap-3 w-fit">
          <Layers className="w-5 h-5 text-brand-red" />
          <div>
            <p className="text-xs text-brand-gray-mid">Combined monthly target across all categories</p>
            <p className="text-lg font-bold text-brand-black">{formatQty(totalMonthly)} <span className="text-xs font-normal text-brand-gray-mid">baseline units/mo</span></p>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                  <th className="text-left font-medium px-5 py-2.5">Category</th>
                  <th className="text-right font-medium px-3 py-2.5">Items</th>
                  <th className="text-right font-medium px-3 py-2.5">Breakeven</th>
                  <th className="text-right font-medium px-3 py-2.5">Total sold</th>
                  <th className="text-right font-medium px-3 py-2.5">Monthly target</th>
                  <th className="text-right font-medium px-5 py-2.5">{MONTHS[currentMonth]} goal</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.category} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                    <td className="px-5 py-2.5 font-medium text-brand-black">
                      {r.highValueCount > 0 && <Star className="inline w-3.5 h-3.5 mr-1.5 text-brand-yellow fill-brand-yellow align-text-bottom" />}
                      {r.category}
                    </td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.itemCount}</td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.breakevenCount}</td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{formatQty(r.totalSold)}</td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.monthlyTarget ? formatQty(r.monthlyTarget) : "—"}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-brand-black">{r.monthlyTarget ? formatQty(r.thisMonthTarget) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <p className="text-xs text-brand-gray-mid">Categories are auto-derived from item-name series (DC, HF, ANS, TWS, S, W…). Tell me your real category names anytime and I&apos;ll regroup.</p>
      </main>
    </>
  );
}
