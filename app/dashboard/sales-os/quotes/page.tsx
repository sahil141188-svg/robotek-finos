/**
 * Sales OS — Quotations list.
 */
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { getQuotes } from "@/lib/crm/quotes";
import { formatIndian } from "@/lib/format";
import { Plus, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-brand-gray-light text-brand-gray-mid",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function QuotesPage() {
  const quotes = await getQuotes();
  return (
    <>
      <Header
        title="Quotations"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Quotations" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-brand-gray-mid">{quotes.length} quotations</p>
          <Link href="/dashboard/sales-os/quotes/new" className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
            <Plus className="w-4 h-4" /> New Quotation
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
                <th className="px-4 py-3 font-medium">Quote #</th>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-brand-gray-mid">No quotations yet. Create one to get started.</td></tr>}
              {quotes.map((q) => (
                <tr key={q.id} className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/sales-os/quotes/${q.id}`} className="font-medium text-brand-black hover:text-brand-red inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-brand-gray-mid" />{q.quote_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-brand-gray-mid">{q.account_name ?? "—"}</td>
                  <td className="px-4 py-3 text-brand-gray-mid">{fmtDate(q.created_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">{formatIndian(Number(q.total) || 0, 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[q.status]}`}>{q.status}</span>
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
