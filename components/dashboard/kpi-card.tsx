/**
 * KpiCard — Reusable KPI tile for the CFO Dashboard.
 * RULE 1: Every number is clickable — wraps entire card in a Link.
 * RULE 7: Mobile responsive — full width on small screens.
 */

import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  /** Optional label shown in small text below the title (e.g. "Mar 2026") */
  period?: string;
  trend?: "up" | "down" | "neutral";
  trendText?: string;
  /** Red badge text for overdue/critical items e.g. "₹16.95L overdue" */
  alertText?: string;
  /** Sub-note when no trend or alert is needed */
  subtext?: string;
  /** Drill-down destination URL — RULE 1: every number links somewhere */
  href: string;
}

export function KpiCard({
  title,
  value,
  period,
  trend,
  trendText,
  alertText,
  subtext,
  href,
}: KpiCardProps) {
  const trendColor =
    trend === "up" ? "text-green-600" :
    trend === "down" ? "text-red-500" :
    "text-brand-gray-mid";

  const TrendIcon =
    trend === "up" ? TrendingUp :
    trend === "down" ? TrendingDown :
    Minus;

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-border bg-white p-5
                 hover:border-brand-red/40 hover:shadow-sm transition-all cursor-pointer"
    >
      {/* Header */}
      <p className="text-xs text-brand-gray-mid">{title}</p>
      {period && (
        <p className="text-[10px] text-brand-gray-mid/60 mt-0.5">{period}</p>
      )}

      {/* Value */}
      <p className="text-2xl font-bold text-brand-black mt-2 group-hover:text-brand-red transition-colors">
        {value}
      </p>

      {/* Footer row */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {trend && trendText && (
          <div className="flex items-center gap-1">
            <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />
            <span className={`text-xs ${trendColor}`}>{trendText}</span>
          </div>
        )}
        {alertText && (
          <div className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-red-600 font-medium">{alertText}</span>
          </div>
        )}
        {subtext && !trend && !alertText && (
          <span className="text-xs text-brand-gray-mid">{subtext}</span>
        )}
      </div>
    </Link>
  );
}
