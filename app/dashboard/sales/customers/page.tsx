/**
 * CRR — Customer Targets. All customers with their focus-item count + combined
 * monthly target; click through to that customer's item-wise targets.
 */
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/server";
import { getCustomerTargetsList } from "@/lib/supabase/sales-queries";
import { formatQty } from "@/lib/format";
import { Users, Phone, ChevronRight, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function CustomerTargetsPage() {
  const supabase = await createClient();
  const { rows, withPhone } = await getCustomerTargetsList(supabase);

  return (
    <>
      <Header
        title="Customer Targets"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "CRR", href: "/dashboard/sales" }, { label: "Customer Targets" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6 max-w-6xl">
        <div className="flex flex-wrap gap-3">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div><p className="text-xs text-brand-gray-mid">Customers</p><p className="text-lg font-bold text-brand-black">{rows.length}</p></div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <Phone className="w-5 h-5 text-green-600" />
            <div><p className="text-xs text-brand-gray-mid">WhatsApp-ready</p><p className="text-lg font-bold text-brand-black">{withPhone}</p></div>
          </div>
        </div>

        <section className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
                  <th className="text-left font-medium px-5 py-2.5">Customer</th>
                  <th className="text-right font-medium px-3 py-2.5">Focus items</th>
                  <th className="text-right font-medium px-3 py-2.5">Monthly target</th>
                  <th className="text-right font-medium px-3 py-2.5">Orders</th>
                  <th className="text-left font-medium px-3 py-2.5">Last order</th>
                  <th className="px-3 py-2.5"></th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/dashboard/sales/${r.id}`} className="font-medium text-brand-black hover:text-brand-red">{r.name}</Link>
                      {r.hasPhone && <Phone className="inline w-3 h-3 ml-2 text-green-600" />}
                      {r.overdueRatio != null && r.overdueRatio >= 1.5 && <AlertTriangle className="inline w-3.5 h-3.5 ml-1.5 text-amber-500" />}
                    </td>
                    <td className="px-3 py-3 text-right text-brand-gray-mid">{r.focusItems}</td>
                    <td className="px-3 py-3 text-right font-medium text-brand-black">{r.focusMonthlyTotal ? formatQty(r.focusMonthlyTotal) : "—"}</td>
                    <td className="px-3 py-3 text-right text-brand-gray-mid">{r.totalOrders}</td>
                    <td className="px-3 py-3 text-brand-gray-mid">{fmtDate(r.lastOrderAt)}</td>
                    <td className="px-3 py-3">{r.segment && <span className="text-[10px] uppercase tracking-wide text-brand-gray-mid">{r.segment}</span>}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={`/dashboard/sales/${r.id}`} className="text-brand-gray-mid hover:text-brand-red inline-flex" aria-label="Open"><ChevronRight className="w-4 h-4" /></Link>
                    </td>
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
