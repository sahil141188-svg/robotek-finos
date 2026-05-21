import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { TrendingDown, AlertCircle } from "lucide-react";

const SAMPLE_VENDORS = [
  { name: "Foxconn Components Ltd",    outstanding: "₹18,40,000", overdue: "₹6,20,000", dpo: 42, status: "overdue" },
  { name: "Shenzhen Parts Co.",        outstanding: "₹12,75,000", overdue: "—",         dpo: 28, status: "current" },
  { name: "Anand Cables Pvt Ltd",      outstanding: "₹8,30,000",  overdue: "₹8,30,000", dpo: 67, status: "overdue" },
  { name: "Delhi Packaging Supplies",  outstanding: "₹4,15,000",  overdue: "—",         dpo: 15, status: "current" },
  { name: "Kumar Electronics",         outstanding: "₹2,90,000",  overdue: "₹1,45,000", dpo: 38, status: "overdue" },
];

export default async function PayablesPage() {
  await requireAuth();

  const totalOutstanding = "₹46,50,000";
  const totalOverdue     = "₹16,95,000";
  const avgDpo           = "38 days";

  return (
    <>
      <Header
        title="Accounts Payable"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Accounts Payable" }]}
        showImport={true}
        importModule="payables"
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <TrendingDown className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Full AP Health module — coming on Day 7</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Vendor aging buckets (0–30, 31–60, 61–90, 90+ days), DPO trend, overdue escalation,
              full ledger drill-down to source invoice. Import Busy data to populate.
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Outstanding", value: totalOutstanding, sub: "across all vendors",  color: "text-brand-black" },
            { label: "Overdue (>30 days)", value: totalOverdue,    sub: "needs immediate action", color: "text-red-600" },
            { label: "Avg DPO",           value: avgDpo,           sub: "days payable outstanding", color: "text-brand-black" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <p className="text-xs text-brand-gray-mid">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              <p className="text-xs text-brand-gray-mid mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Vendor table */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-brand-gray-light">
            <p className="text-sm font-semibold text-brand-black">Top Vendors by Outstanding</p>
            <span className="text-xs text-brand-gray-mid">Sample data — import Busy export to populate</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-brand-gray-light/50">
              <tr>
                {["Vendor", "Outstanding", "Overdue", "DPO", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-brand-gray-mid">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SAMPLE_VENDORS.map((v) => (
                <tr key={v.name} className="hover:bg-brand-gray-light/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-brand-black">{v.name}</td>
                  <td className="px-4 py-3 text-brand-black">{v.outstanding}</td>
                  <td className={`px-4 py-3 font-medium ${v.overdue !== "—" ? "text-red-600" : "text-brand-gray-mid"}`}>{v.overdue}</td>
                  <td className="px-4 py-3 text-brand-black">{v.dpo}d</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      v.status === "overdue" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </>
  );
}
