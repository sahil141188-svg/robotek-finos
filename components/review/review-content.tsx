"use client";

/**
 * ReviewContent — Period tabs (Weekly / Monthly / Quarterly) + scorecard + PDF export.
 * Uses window.print() with print-specific Tailwind classes for PDF export.
 */

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Printer, ExternalLink, AlertCircle, Info } from "lucide-react";
import {
  SCORECARD_DATA, trendClass, trendIcon,
  type PeriodTab, type MetricRow,
} from "@/lib/review-data";

const TABS: { key: PeriodTab; label: string }[] = [
  { key: "weekly",    label: "Weekly" },
  { key: "monthly",   label: "Monthly" },
  { key: "quarterly", label: "Quarterly" },
];

export function ReviewContent() {
  const [period, setPeriod] = useState<PeriodTab>("monthly");
  const data = SCORECARD_DATA[period];

  const handlePrint = () => {
    if (typeof window !== "undefined") window.print();
  };

  return (
    <div className="space-y-5 print:space-y-4">

      {/* ── Controls row ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {/* Period tabs */}
        <div className="flex items-center gap-1 bg-brand-gray-light rounded-xl p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`text-xs font-medium px-4 py-1.5 rounded-lg transition-all ${
                period === key
                  ? "bg-brand-red text-white shadow-sm"
                  : "text-brand-gray-mid hover:text-brand-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Export button */}
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 bg-brand-black text-white rounded-lg hover:bg-brand-maroon transition-colors"
        >
          <Printer className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* Print header (only visible when printing) */}
      <div className="hidden print:block mb-6">
        <p className="text-xl font-bold text-brand-black">Robotek India — Finance Review</p>
        <p className="text-sm text-brand-gray-mid mt-1">{data.period_label} · Generated {data.as_of}</p>
      </div>

      {/* ── Health score bar ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border p-5 print:border-0 print:p-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-brand-gray-mid uppercase tracking-wide">{data.period_label}</p>
            <p className="text-2xl font-bold text-brand-black mt-0.5">
              Health Score: <span className={
                data.health_score >= 85 ? "text-green-600"
                : data.health_score >= 70 ? "text-amber-600"
                : "text-red-600"
              }>{data.health_score}/100</span>
              <span className="text-base font-medium text-brand-gray-mid ml-2">— {data.health_label}</span>
            </p>
            {/* Score bar */}
            <div className="mt-2 h-2 w-64 bg-brand-gray-light rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${data.health_color}`}
                style={{ width: `${data.health_score}%` }}
              />
            </div>
          </div>
        </div>

        {/* Executive summary */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-sm text-brand-gray-mid">{data.executive_summary}</p>
          </div>
        </div>
      </div>

      {/* ── Scorecard sections ─────────────────────────────────── */}
      {data.sections.map((section) => (
        <div key={section.title} className="bg-white rounded-xl border border-border overflow-hidden print:break-inside-avoid">
          <div className="px-4 py-3 border-b border-border bg-brand-gray-light">
            <h3 className="text-sm font-semibold text-brand-black">{section.title}</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {section.metrics.map((row) => (
              <MetricCard key={row.id} row={row} />
            ))}
          </div>
        </div>
      ))}

      {/* Print footer */}
      <div className="hidden print:block mt-8 pt-4 border-t border-border text-xs text-brand-gray-mid">
        <p>Robotek India Pvt Ltd — Robotek FinOS · Confidential · Generated {data.as_of}</p>
      </div>
    </div>
  );
}

function MetricCard({ row }: { row: MetricRow }) {
  const icon = trendIcon(row);
  const cls  = trendClass(row);
  const isAlert = row.raw === 0 && row.value.toLowerCase().includes("overdue");

  const inner = (
    <div className={`p-4 space-y-1 h-full ${isAlert ? "bg-red-50/50" : ""}`}>
      <p className="text-xs text-brand-gray-mid">{row.label}</p>
      <p className={`text-xl font-bold ${isAlert ? "text-red-700" : "text-brand-black"}`}>
        {row.value}
      </p>

      {/* Trend row */}
      {row.change_pct !== null ? (
        <div className={`flex items-center gap-1 ${cls}`}>
          {icon === "up"      && <TrendingUp    className="w-3 h-3" />}
          {icon === "down"    && <TrendingDown   className="w-3 h-3" />}
          {icon === "neutral" && <Minus          className="w-3 h-3" />}
          <span className="text-xs font-medium">
            {row.change_pct > 0 ? "+" : ""}{row.change_pct}%
          </span>
          {row.change_label && (
            <span className="text-xs text-brand-gray-mid">{row.change_label}</span>
          )}
        </div>
      ) : row.change_label ? (
        <p className="text-xs text-brand-gray-mid">{row.change_label}</p>
      ) : null}

      {/* Note */}
      {row.note && (
        <div className="flex items-start gap-1 mt-1">
          <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-700">{row.note}</p>
        </div>
      )}

      {/* Drill link indicator (print: hidden) */}
      {row.drill_href && (
        <p className="print:hidden text-[10px] text-brand-gray-mid/60 flex items-center gap-0.5 mt-0.5">
          <ExternalLink className="w-2.5 h-2.5" /> click to drill down
        </p>
      )}
    </div>
  );

  if (row.drill_href) {
    return (
      <Link
        href={row.drill_href}
        className="block hover:bg-brand-gray-light/40 transition-colors print:pointer-events-none"
      >
        {inner}
      </Link>
    );
  }
  return <div>{inner}</div>;
}
