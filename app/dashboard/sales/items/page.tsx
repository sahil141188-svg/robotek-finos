/**
 * CRR — Company Item Targets. Top 50 selling items with inline-editable
 * monthly targets. Server component with client EditableTarget cells.
 */
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getItemTargets } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { Star, Package } from "lucide-react";
import { ItemTargetRow as ItemTargetRowComp } from "@/components/sales/item-target-row";

export const dynamic = "force-dynamic";
const MONTHS = ["","January","February","March","April","May","June","July","August","September","October","November","December"];

export default async function ItemTargetsPage() {
  const supabase = await createClient();
  const { items, currentMonth } = await getItemTargets(supabase, 50);
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
              <p className="text-xs text-brand-gray-mid">Top 50 items · combined monthly baseline</p>
              <p className="text-lg font-bold text-brand-black">{formatQty(totalMonthly)} <span className="text-xs font-normal text-brand-gray-mid">units/mo</span></p>
            </div>
          </div>
          <p className="text-xs text-brand-gray-mid max-w-sm">
            <Star className="inline w-3 h-3 text-brand-yellow fill-brand-yellow" /> = high-value.
            Hover any target to edit it inline. Targets scale by the seasonal curve.
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
                  <ItemTargetRowComp key={it.id} item={it} rank={i + 1} monthLabel={MONTHS[currentMonth]} />
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <p className="text-xs text-brand-gray-mid">Targets = active-month demand across all dealers + 10% growth, scaled by season. Rapid + Rapid-C are separate SKUs — their combined demand is {formatQty(items.filter(i => /^rapid/i.test(i.name)).reduce((s,i) => s + i.monthlyTarget, 0))} units/mo.</p>
      </main>
    </>
  );
}
