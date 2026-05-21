import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { TrendingUp } from "lucide-react";

const SAMPLE_CUSTOMERS = [
  { name: "Reliance Retail Ltd",         outstanding: "₹24,60,000", overdue: "₹8,40,000",  dso: 55, status: "overdue" },
  { name: "Amazon India Pvt Ltd",        outstanding: "₹17,30,000", overdue: "—",           dso: 22, status: "current" },
  { name: "Croma (Infiniti Retail)",     outstanding: "₹11,20,000", overdue: "₹11,20,000",  dso: 78, status: "overdue" },
  { name: "Flipkart Internet Pvt Ltd",   outstanding: "₹9,45,000",  overdue: "—",           dso: 30, status: "current" },
  { name: "Vijay Sales",                 outstanding: "₹5,80,000",  overdue: "₹2,90,000",   dso: 48, status: "overdue" },
];

export default async function ReceivablesPage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Accounts Receivable"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Accounts Receivable" }]}
        showImport={true}
        importModule="receivables"
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <TrendingUp className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Full AR Health module — coming on Day 8–9</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Customer aging buckets, DSO trend, collection log, overdue escalation,
              full ledger drill-down to source invoice. Import Busy data to populate.
            </p>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Receivable",   value: "₹68,35,000", sub: "across all customers",    color: "text-brand-black" },
            { label: "Overdue (>30 days)", value: "₹22,50,000", sub: "needs follow-up",          color: "text-red-600" },
            { label: "Avg DSO",            value: "46 days",    sub: "days sales outstanding",   color: "text-brand-black" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="rounded-xl border border-border bg-white p-5">
              <p className="text-xs text-brand-gray-mid">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
              <p className="text-xs text-brand-gray-mid mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* Customer table */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-brand-gray-light">
            <p className="text-sm font-semibold text-brand-black">Top Customers by Outstanding</p>
            <span className="text-xs text-brand-gray-mid">Sample data — import Busy export to populate</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-brand-gray-light/50">
              <tr>
                {["Customer", "Outstanding", "Overdue", "DSO", "Status"].map(h => (
                  <th key={h} className="text-left px-4 py-2 text-xs font-medium text-brand-gray-mid">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SAMPLE_CUSTOMERS.map((c) => (
                <tr key={c.name} className="hover:bg-brand-gray-light/30 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-brand-black">{c.name}</td>
                  <td className="px-4 py-3 text-brand-black">{c.outstanding}</td>
                  <td className={`px-4 py-3 font-medium ${c.overdue !== "—" ? "text-red-600" : "text-brand-gray-mid"}`}>{c.overdue}</td>
                  <td className="px-4 py-3 text-brand-black">{c.dso}d</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      c.status === "overdue" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    }`}>
                      {c.status}
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
