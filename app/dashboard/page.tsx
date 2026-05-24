/**
 * CFO Dashboard — Module 1 (Day 2 complete).
 *
 * Layout (top → bottom):
 *   1. Business Health Banner
 *   2. KPI Tiles grid (8 tiles, 4-per-row on desktop)
 *   3. Revenue trend chart + Cost breakdown chart
 *   4. AP/AR Aging chart + Compliance upcoming widget
 *
 * RULE 1: Every KPI tile is a Link → Layer 2 drill page.
 * RULE 2: Three-layer drill — Dashboard → Category → Transactions.
 * RULE 5: Indian number format (Lakhs / Crores).
 */

import type { DashboardKPI } from "@/app/actions/dashboard-kpis";
import type { KpiSummary } from "@/lib/dashboard-data";
import { requireAuth } from "@/lib/auth";
import { fetchDashboardKPIs } from "@/app/actions/dashboard-kpis";
import { Header } from "@/components/layout/header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { HealthBanner } from "@/components/dashboard/health-banner";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ExpenseChart } from "@/components/dashboard/expense-chart";
import { AgingChart } from "@/components/dashboard/aging-chart";
import { ComplianceMini } from "@/components/dashboard/compliance-mini";
import {
  SAMPLE_KPI,
  REVENUE_TREND,
  EXPENSE_BREAKDOWN,
  AGING_DATA,
  UPCOMING_COMPLIANCE,
} from "@/lib/dashboard-data";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

function transformDashboardKPI(dkpi: DashboardKPI): KpiSummary {
  return {
    revenue: {
      mtd: dkpi.revenue.current / 100000,  // Convert to Lakhs
      ytd: dkpi.revenue.current / 100000,  // For now, use MTD as YTD (would come from full FY query)
      vs_last_month_pct: dkpi.revenue.vs_last_month_pct,
      vs_last_year_pct: 0,  // Would require previous FY data
    },
    cogs: {
      mtd: dkpi.cogs.current / 100000,
      ytd: dkpi.cogs.current / 100000,
      vs_last_month_pct: dkpi.cogs.vs_last_month_pct,
    },
    gross_margin: {
      pct: dkpi.gross_margin.current,
      vs_last_month_pp: dkpi.gross_margin.vs_last_month_pct,
      vs_last_year_pp: 0,
    },
    ap: {
      total: dkpi.ap.total / 100000,
      overdue: dkpi.ap.overdue / 100000,
    },
    ar: {
      total: dkpi.ar.total / 100000,
      overdue: dkpi.ar.overdue / 100000,
    },
    cash: {
      balance: dkpi.cash.current / 100000,
      vs_last_month_pct: dkpi.cash.vs_last_month_pct,
    },
    tax: {
      gst: 0,  // Would require additional ledger analysis
      tds: 0,  // Would require additional ledger analysis
      total: dkpi.tax.total / 100000,
    },
    opex: {
      mtd: dkpi.opex.current / 100000,
      vs_last_month_pct: dkpi.opex.vs_last_month_pct,
    },
  };
}

/**
 * Derives an overall business health score (0-100) from key KPI signals.
 * Higher score = healthier business. Used by the HealthBanner component.
 */
function computeHealthScore(kpi: KpiSummary): number {
  let score = 100;

  // Revenue growth: positive = good
  if (kpi.revenue.vs_last_month_pct < 0)  score -= 10;
  if (kpi.revenue.vs_last_month_pct < -10) score -= 5;

  // AP overdue: > 20% of total AP is a red flag
  // Guard against division by zero when no AP data is imported yet
  const apOverduePct = kpi.ap.total > 0 ? (kpi.ap.overdue / kpi.ap.total) * 100 : 0;
  if (apOverduePct > 30) score -= 15;
  else if (apOverduePct > 15) score -= 8;

  // AR overdue: > 25% of total AR is concerning
  // Guard against division by zero when no AR data is imported yet
  const arOverduePct = kpi.ar.total > 0 ? (kpi.ar.overdue / kpi.ar.total) * 100 : 0;
  if (arOverduePct > 30) score -= 12;
  else if (arOverduePct > 20) score -= 6;

  // Tax outstanding > 10L = moderate risk
  if (kpi.tax.total > 15) score -= 8;
  else if (kpi.tax.total > 8) score -= 4;

  return Math.max(0, Math.min(100, score));
}

/** Format a Lakhs value for display in a KPI tile (kpi values are in Lakhs).
 *  Guards against: NaN, Infinity, -0, and tiny floating-point noise (< ₹500 → show "—") */
function fmtL(lakhs: number): string {
  if (!isFinite(lakhs) || Math.abs(lakhs) < 0.005) return "—";
  if (lakhs < 0) return `−${fmtL(-lakhs)}`;
  if (lakhs >= 100) return `₹${(lakhs / 100).toFixed(2)} Cr`;
  if (lakhs >= 1)   return `₹${lakhs.toFixed(2)}L`;
  return `₹${(lakhs * 100).toFixed(0)}K`;
}

/** Dynamic period label for current month */
function currentMonthLabel(): string {
  return new Date().toLocaleString("en-IN", { month: "short", year: "numeric" });
}

/** Trend text from a percentage change */
function trendText(pct: number, label = "vs last month"): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% ${label}`;
}

export default async function DashboardPage() {
  const { profile } = await requireAuth();

  // Fetch live KPI data from transactions table
  const liveKPI = await fetchDashboardKPIs();

  // Use live data if available, fallback to sample data
  const kpi: KpiSummary = liveKPI ? transformDashboardKPI(liveKPI) : SAMPLE_KPI;
  // FIX N6: isShowingSampleData was previously used to show a banner but the
  // KPI tile VALUES were hardcoded strings — they never reflected live data.
  // Now tiles always show kpi values (live when imported, zeros when not).
  const isShowingSampleData = !liveKPI || (kpi.revenue.mtd === 0 && kpi.cogs.mtd === 0);
  const healthScore = computeHealthScore(kpi);
  const period = currentMonthLabel();

  return (
    <>
      <Header
        title="CFO Dashboard"
        breadcrumbs={[{ label: "Dashboard" }]}
        showImport={true}
        importModule="transactions"
      />

      <main className="flex-1 p-6 space-y-5">

        {/* ── Demo-data notice — shown only when no real data is imported ─────── */}
        {isShowingSampleData && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs text-amber-800">
              <strong>Showing sample data.</strong> These numbers are illustrative only and do not reflect your actual financials.{" "}
              <Link href="/dashboard/import" className="underline font-semibold hover:text-amber-900">
                Import your Busy / bank data →
              </Link>
              {" "}to see real figures on this dashboard.
            </div>
          </div>
        )}

        {/* ── 1. Business Health Banner ─────────────────────────────────── */}
        <HealthBanner kpi={kpi} healthScore={healthScore} />

        {/* ── 2. KPI Tiles ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Row 1 — FIX N6: values now driven by live kpi variable, not hardcoded strings */}
          <KpiCard
            title="Revenue MTD"
            period={period}
            value={fmtL(kpi.revenue.mtd)}
            trend={kpi.revenue.vs_last_month_pct >= 0 ? "up" : "down"}
            trendText={trendText(kpi.revenue.vs_last_month_pct)}
            href="/dashboard/drill/revenue"
          />
          <KpiCard
            title="COGS MTD"
            period={period}
            value={fmtL(kpi.cogs.mtd)}
            trend={kpi.cogs.vs_last_month_pct <= 0 ? "up" : "down"}
            trendText={trendText(kpi.cogs.vs_last_month_pct)}
            href="/dashboard/drill/cogs"
          />
          <KpiCard
            title="Gross Margin"
            period={period}
            value={kpi.gross_margin.pct > 0 ? `${kpi.gross_margin.pct.toFixed(1)}%` : "—"}
            trend={kpi.gross_margin.vs_last_month_pp >= 0 ? "up" : "down"}
            trendText={`${kpi.gross_margin.vs_last_month_pp >= 0 ? "+" : ""}${kpi.gross_margin.vs_last_month_pp.toFixed(1)}pp vs last month`}
            href="/dashboard/drill/gross-margin"
          />
          <KpiCard
            title="Cash Balance"
            period="As of today"
            value={fmtL(kpi.cash.balance)}
            trend={kpi.cash.vs_last_month_pct >= 0 ? "up" : "down"}
            trendText={trendText(kpi.cash.vs_last_month_pct)}
            href="/dashboard/banking"
          />

          {/* Row 2 */}
          <KpiCard
            title="AP Outstanding"
            value={fmtL(kpi.ap.total)}
            subtext="Accounts Payable"
            alertText={kpi.ap.overdue > 0 ? `${fmtL(kpi.ap.overdue)} overdue` : undefined}
            href="/dashboard/payables"
          />
          <KpiCard
            title="AR Outstanding"
            value={fmtL(kpi.ar.total)}
            subtext="Accounts Receivable"
            alertText={kpi.ar.overdue > 0 ? `${fmtL(kpi.ar.overdue)} overdue` : undefined}
            href="/dashboard/receivables"
          />
          <KpiCard
            title="Tax Liability"
            value={fmtL(kpi.tax.total)}
            trend="neutral"
            trendText="GST + TDS pending"
            href="/dashboard/drill/tax"
          />
          <KpiCard
            title="OpEx MTD"
            period={period}
            value={fmtL(kpi.opex.mtd)}
            trend={kpi.opex.vs_last_month_pct <= 0 ? "up" : "down"}
            trendText={trendText(kpi.opex.vs_last_month_pct)}
            href="/dashboard/drill/opex"
          />
        </div>

        {/* ── 3. Revenue Trend + Cost Breakdown ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <RevenueChart data={REVENUE_TREND} />
          </div>
          <div>
            <ExpenseChart data={EXPENSE_BREAKDOWN} />
          </div>
        </div>

        {/* ── 4. Aging + Compliance ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgingChart data={AGING_DATA} />
          <ComplianceMini items={UPCOMING_COMPLIANCE} />
        </div>

      </main>
    </>
  );
}
