/**
 * HealthBanner — Business health score summary bar at the top of the CFO Dashboard.
 * Score is computed from KPI signals: revenue trend, overdue AP/AR, compliance status.
 */

import Link from "next/link";
import { TrendingUp, AlertTriangle, Calendar, IndianRupee } from "lucide-react";
import type { KpiSummary } from "@/lib/dashboard-data";

interface HealthBannerProps {
  kpi: KpiSummary;
  healthScore: number; // 0–100
}

export function HealthBanner({ kpi, healthScore }: HealthBannerProps) {
  const isHealthy  = healthScore >= 80;
  const isModerate = healthScore >= 60 && healthScore < 80;

  const bannerBg    = isHealthy  ? "bg-green-50 border-green-200"  :
                      isModerate ? "bg-amber-50 border-amber-200"  :
                                   "bg-red-50   border-red-200";
  const scoreColor  = isHealthy  ? "text-green-700" :
                      isModerate ? "text-amber-700" :
                                   "text-red-700";
  const scoreLabel  = isHealthy  ? "Healthy"              :
                      isModerate ? "Good · Review Needed"  :
                                   "Needs Attention";

  return (
    <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${bannerBg}`}>

      {/* Score */}
      <div className="flex items-center gap-3 shrink-0">
        <div className={`text-4xl font-extrabold tabular-nums ${scoreColor}`}>
          {healthScore}
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-brand-gray-mid font-medium">
            Business Health
          </p>
          <p className={`text-sm font-semibold ${scoreColor}`}>{scoreLabel}</p>
        </div>
        <div className="w-px h-10 bg-border mx-1 hidden sm:block" />
      </div>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-3 flex-1">
        <Chip
          icon={<TrendingUp className="w-3.5 h-3.5 text-green-600" />}
          label="Revenue MTD"
          value={`+${kpi.revenue.vs_last_month_pct}%`}
          valueClass="text-green-600"
        />
        <Chip
          icon={<AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
          label="AP Overdue"
          value={`₹${kpi.ap.overdue}L`}
          valueClass="text-red-600"
        />
        <Chip
          icon={<AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
          label="AR Overdue"
          value={`₹${kpi.ar.overdue}L`}
          valueClass="text-amber-600"
        />
        <Chip
          icon={<IndianRupee className="w-3.5 h-3.5 text-brand-maroon" />}
          label="Tax Pending"
          value={`₹${kpi.tax.total}L`}
          valueClass="text-brand-maroon"
        />
        <Chip
          icon={<Calendar className="w-3.5 h-3.5 text-brand-gray-mid" />}
          label="Compliance"
          value="8/10 · 2 pending"
          valueClass="text-brand-black"
        />
      </div>

      {/* CTA */}
      <Link
        href="/dashboard/review"
        className="text-xs font-semibold text-brand-red hover:underline whitespace-nowrap shrink-0"
      >
        Full Report →
      </Link>
    </div>
  );
}

/** Small inline stat chip used inside the banner */
function Chip({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5 bg-white/60 rounded-lg px-2.5 py-1.5 border border-white/80">
      {icon}
      <span className="text-xs text-brand-gray-mid">{label}</span>
      <span className={`text-xs font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
