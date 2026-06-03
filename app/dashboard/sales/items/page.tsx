/**
 * CRR — Company Item Targets. Top 50 selling items with their monthly target
 * (history +10%), this month's seasonal goal, category and ⭐ value flag.
 */
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getItemTargets } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { Star, Package } from "lucide-react";

export const dynamic = "force-dynamic";
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ItemTargetsPage() {
  const supabase = await createClient();
  const { items, currentMonth, provisionalMonth } = await getItemTargets(supabase, 50);
  const totalMonthly = items.reduce((a, i) => a + i.monthlyTarget, 0);

  return (
    <>
      <Header
        title="Company Targets — Items"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "CRR", href: "/dashboard/sales" }, { label: "Item Targets" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-border bg-white p-4 flex items-center gap-3">
            <Package className="w-5 h-5 text-brand-red" />
            <div>
              <p className="text-xs text-brand-gray-mid">Top 50 items · combined {MONTHS[currentMonth]} target</p>
              <p className="text-lg font-bold text-brand-black">{formatQty(Math.round(totalMonthly * (provisionalMonth ? 1 : 1)))} <span className="text-xs font-normal text-brand-gray-mid">baseline units/mo</span></p>
            </div>
          </div>
          <p className="text-xs text-brand-gray-mid max-w-sm">
            Ranked by units sold. <Star className="inline w-3 h-3 text-brand-yellow fill-brand-yellow" /> = high-value (push first). Targets in quantity; monthly goal scales by season.
          </p>
        </div>

        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                  <th className="text-left font-medium px-5 py-2.5">#</th>
                  <th className="text-left font-medium px-3 py-2.5">Item</th>
                  <th className="text-left font-medium px-3 py-2.5">Category</th>
                  <th className="text-right font-medium px-3 py-2.5">Total sold</th>
                  <th className="text-right font-medium px-3 py-2.5">Monthly target</th>
                  <th className="text-right font-medium px-5 py-2.5">{MONTHS[currentMonth]} goal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={it.id} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                    <td className="px-5 py-2.5 text-brand-gray-mid">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-brand-black">
                      {it.highValue && <Star className="inline w-3.5 h-3.5 mr-1.5 text-brand-yellow fill-brand-yellow align-text-bottom" />}
                      {it.name}
                    </td>
                    <td className="px-3 py-2.5"><span className="text-xs rounded-full bg-brand-gray-light px-2 py-0.5 text-brand-gray-mid">{it.category ?? "—"}</span></td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{formatQty(it.totalSold)}</td>
                    <td className="px-3 py-2.5 text-right text-brand-gray-mid">{it.monthlyTarget ? formatQty(it.monthlyTarget) : "—"}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-brand-black">{it.monthlyTarget ? formatQty(it.thisMonthTarget) : "—"}</td>
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
