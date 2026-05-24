/**
 * Layer 2 Drill — Monthly breakdown for a given KPI module.
 * URL: /dashboard/drill/[module]
 *
 * Supported modules: revenue | cogs | gross-margin | cash | tax | opex
 * AP / AR have dedicated pages → redirect to /dashboard/payables|receivables.
 *
 * RULE 2: Second click in the three-layer drill architecture.
 * RULE 1: Every row links to Layer 3 (individual transactions).
 */

import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, ExternalLink } from "lucide-react";
import {
  DRILL_CONFIG,
  type DrillModuleSlug,
  type MonthlyBreakdown,
} from "@/lib/dashboard-data";

type Props = {
  params: Promise<{ module: string }>;
};

/** Format a value in Lakhs or as a percentage depending on unit */
function formatValue(value: number, unit: "lakhs" | "percent") {
  if (unit === "percent") return `${value.toFixed(1)}%`;
  return `₹${value.toFixed(1)} L`;
}

export default async function DrillPage({ params }: Props) {
  await requireAuth();
  const { module } = await params;

  // AP / AR redirect to dedicated full modules
  if (module === "payables")    redirect("/dashboard/payables");
  if (module === "receivables") redirect("/dashboard/receivables");

  const config = DRILL_CONFIG[module as DrillModuleSlug];
  if (!config) notFound();

  const { title, metric, unit, data, breadcrumb } = config;

  // Guard against empty data — all drill arrays are empty until real data is imported.
  // data[0] would be undefined on an empty array, crashing bestMonth.month access.
  if (data.length === 0) {
    redirect("/dashboard");
  }

  // Summary stats
  const total    = data.reduce((s, d) => s + d.value, 0);
  const avgValue = data.length > 0 ? total / data.length : 0;
  const bestMonth = data.reduce((b, d) => (d.value > b.value ? d : b), data[0]);
  const ytdLabel = unit === "percent"
    ? `${avgValue.toFixed(1)}% (avg)`
    : `₹${total.toFixed(1)} L`;

  return (
    <>
      <Header
        title={title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: breadcrumb },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6">

        {/* ── Summary KPI tiles ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="text-xs text-brand-gray-mid">
              {unit === "percent" ? "Full-Year Average" : "FY 2025-26 Total"}
            </p>
            <p className="text-2xl font-bold text-brand-black mt-1">{ytdLabel}</p>
            <p className="text-xs text-brand-gray-mid mt-1">Apr 2025 – Mar 2026</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="text-xs text-brand-gray-mid">Best Month</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{bestMonth.month}</p>
            <p className="text-xs text-brand-gray-mid mt-1">
              {formatValue(bestMonth.value, unit)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-5">
            <p className="text-xs text-brand-gray-mid">Monthly Average</p>
            <p className="text-2xl font-bold text-brand-black mt-1">
              {formatValue(avgValue, unit)}
            </p>
            <p className="text-xs text-brand-gray-mid mt-1">across 12 months</p>
          </div>
        </div>

        {/* ── Monthly breakdown table ───────────────────────────────────── */}
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-brand-gray-light">
            <div>
              <p className="text-sm font-semibold text-brand-black">
                Monthly Breakdown — FY 2025-26
              </p>
              <p className="text-xs text-brand-gray-mid">
                Click &quot;View →&quot; on any row to see individual transactions
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-xs text-brand-gray-mid hover:text-brand-red flex items-center gap-1"
            >
              ← Back to Dashboard
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-gray-light/40">
                <tr>
                  {["Month", metric, "vs Prev Month", "Transactions", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-2.5 text-xs font-medium text-brand-gray-mid"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((row: MonthlyBreakdown) => (
                  <TableRow
                    key={row.period}
                    row={row}
                    unit={unit}
                    module={module}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </>
  );
}

// ─── Sub-component: single table row ─────────────────────────────────────────

function TableRow({
  row,
  unit,
  module,
}: {
  row: MonthlyBreakdown;
  unit: "lakhs" | "percent";
  module: string;
}) {
  const hasTrend = row.vs_prev_pct !== 0;

  return (
    <tr className="hover:bg-brand-gray-light/30">
      <td className="px-5 py-3 font-medium text-brand-black">{row.month}</td>
      <td className="px-5 py-3 font-semibold text-brand-black">
        {unit === "percent"
          ? `${row.value.toFixed(1)}%`
          : `₹${row.value.toFixed(1)} L`}
      </td>
      <td className="px-5 py-3">
        {hasTrend ? (
          <div className="flex items-center gap-1">
            {row.vs_prev_pct > 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <span
              className={`text-xs ${
                row.vs_prev_pct > 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {row.vs_prev_pct > 0 ? "+" : ""}
              {row.vs_prev_pct.toFixed(1)}%
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Minus className="w-3.5 h-3.5 text-brand-gray-mid" />
            <span className="text-xs text-brand-gray-mid">baseline</span>
          </div>
        )}
      </td>
      <td className="px-5 py-3 text-brand-gray-mid text-sm">{row.count}</td>
      <td className="px-5 py-3">
        <Link
          href={`/dashboard/drill/${module}/${row.period}`}
          className="inline-flex items-center gap-1 text-xs text-brand-red hover:underline"
        >
          View
          <ExternalLink className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}
