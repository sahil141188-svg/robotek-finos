/**
 * Layer 3 Drill — Individual transaction records for a specific module + period.
 * URL: /dashboard/drill/[module]/[period]
 * e.g. /dashboard/drill/revenue/mar-2026
 *
 * RULE 2: Third (final) layer in the drill architecture.
 * RULE 9: Table is exportable as Excel/PDF (Export button stub — full impl Day 3).
 * RULE 1: Each transaction row is the source record — no further drill needed.
 */

import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";
import {
  DRILL_CONFIG,
  PERIOD_LABELS,
  SAMPLE_TRANSACTIONS,
  type DrillModuleSlug,
  type DrillTransaction,
} from "@/lib/dashboard-data";

type Props = {
  params: Promise<{ module: string; period: string }>;
};

export default async function TransactionPage({ params }: Props) {
  await requireAuth();
  const { module, period } = await params;

  // Validate module
  const config = DRILL_CONFIG[module as DrillModuleSlug];
  if (!config) notFound();

  // Validate period
  const periodLabel = PERIOD_LABELS[period];
  if (!periodLabel) notFound();

  // In a real app: query Supabase transactions table filtered by module + period
  const transactions: DrillTransaction[] = SAMPLE_TRANSACTIONS;

  // Aggregate stats
  const totalDR = transactions
    .filter((t) => t.dr_cr === "DR")
    .reduce((s, t) => s + t.amount, 0);
  const totalCR = transactions
    .filter((t) => t.dr_cr === "CR")
    .reduce((s, t) => s + t.amount, 0);
  const netAmount = totalDR - totalCR;

  return (
    <>
      <Header
        title={`${config.breadcrumb} — ${periodLabel}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: config.breadcrumb, href: `/dashboard/drill/${module}` },
          { label: periodLabel },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6">

        {/* ── Summary tiles ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryTile
            label="Debit Total"
            value={`₹${totalDR.toFixed(2)} L`}
            sub={`${transactions.filter((t) => t.dr_cr === "DR").length} entries`}
            valueClass="text-brand-black"
          />
          <SummaryTile
            label="Credit Total"
            value={`₹${totalCR.toFixed(2)} L`}
            sub={`${transactions.filter((t) => t.dr_cr === "CR").length} entries`}
            valueClass="text-green-600"
          />
          <SummaryTile
            label="Net Amount"
            value={`₹${netAmount.toFixed(2)} L`}
            sub="DR – CR"
            valueClass="text-brand-black"
          />
          <SummaryTile
            label="Transactions"
            value={String(transactions.length)}
            sub={periodLabel}
            valueClass="text-brand-black"
          />
        </div>

        {/* ── Transaction Table ─────────────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          {/* Table header bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-border bg-brand-gray-light">
            <div>
              <p className="text-sm font-semibold text-brand-black">
                Transactions — {periodLabel}
              </p>
              <p className="text-xs text-brand-gray-mid">
                Source: Busy Accounting Software export · {transactions.length} records
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Export stubs — full implementation in Day 3 */}
              <button
                className="inline-flex items-center gap-1.5 text-xs text-brand-gray-mid
                           hover:text-brand-red border border-border rounded-lg px-2.5 py-1.5
                           bg-white hover:border-brand-red/40 transition-colors"
                title="Export as Excel (available after data import in Day 3)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </button>
              <button
                className="inline-flex items-center gap-1.5 text-xs text-brand-gray-mid
                           hover:text-brand-red border border-border rounded-lg px-2.5 py-1.5
                           bg-white hover:border-brand-red/40 transition-colors"
                title="Export as PDF (available after data import in Day 3)"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray-light/40">
                <tr>
                  {[
                    "Date",
                    "Voucher No.",
                    "Ledger / Party",
                    "Narration",
                    "DR / CR",
                    "Amount (₹ L)",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-2.5 text-xs font-medium text-brand-gray-mid whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactions.map((t) => (
                  <TransactionRow key={t.id} t={t} />
                ))}
              </tbody>
              {/* Totals footer */}
              <tfoot className="bg-brand-gray-light/40 border-t-2 border-border">
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-3 text-xs font-semibold text-brand-black"
                  >
                    Total — {periodLabel}
                  </td>
                  <td className="px-5 py-3 text-xs font-bold text-brand-black">
                    ₹{totalDR.toFixed(2)} L DR
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Source file note ──────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl border border-brand-yellow/40 bg-brand-yellow/10 p-4">
          <FileSpreadsheet className="w-4 h-4 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-brand-black">
              Source: Busy Accounting Software
            </p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              These are sample records. Import your Busy export file on the{" "}
              <Link
                href="/dashboard/import"
                className="text-brand-red underline"
              >
                Import page
              </Link>{" "}
              to see real transactions with full drill-down to source invoices.
            </p>
          </div>
        </div>

      </main>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <p className="text-xs text-brand-gray-mid">{label}</p>
      <p className={`text-xl font-bold mt-1 ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid mt-1">{sub}</p>
    </div>
  );
}

function TransactionRow({ t }: { t: DrillTransaction }) {
  const isDebit = t.dr_cr === "DR";
  return (
    <tr className="hover:bg-brand-gray-light/30">
      <td className="px-5 py-3 text-xs text-brand-gray-mid whitespace-nowrap">
        {t.date}
      </td>
      <td className="px-5 py-3 text-xs font-mono text-brand-black">
        {t.voucher_no}
      </td>
      <td className="px-5 py-3 text-xs font-medium text-brand-black">
        {t.ledger}
      </td>
      <td className="px-5 py-3 text-xs text-brand-gray-mid max-w-xs truncate">
        {t.narration}
      </td>
      <td className="px-5 py-3">
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-semibold ${
            isDebit
              ? "bg-blue-50 text-blue-700"
              : "bg-green-50 text-green-700"
          }`}
        >
          {t.dr_cr}
        </span>
      </td>
      <td
        className={`px-5 py-3 text-xs font-semibold whitespace-nowrap tabular-nums ${
          isDebit ? "text-brand-black" : "text-green-600"
        }`}
      >
        {t.amount.toFixed(2)}
      </td>
    </tr>
  );
}
