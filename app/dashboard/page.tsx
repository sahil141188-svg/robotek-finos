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

import { requireAuth } from "@/lib/auth";
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

/**
 * Derives an overall business health score (0-100) from key KPI signals.
 * Higher score = healthier business. Used by the HealthBanner component.
 */
function computeHealthScore(kpi: typeof SAMPLE_KPI): number {
  let score = 100;

  // Revenue growth: positive = good
  if (kpi.revenue.vs_last_month_pct < 0)  score -= 10;
  if (kpi.revenue.vs_last_month_pct < -10) score -= 5;

  // AP overdue: > 20% of total AP is a red flag
  const apOverduePct = (kpi.ap.overdue / kpi.ap.total) * 100;
  if (apOverduePct > 30) score -= 15;
  else if (apOverduePct > 15) score -= 8;

  // AR overdue: > 25% of total AR is concerning
  const arOverduePct = (kpi.ar.overdue / kpi.ar.total) * 100;
  if (arOverduePct > 30) score -= 12;
  else if (arOverduePct > 20) score -= 6;

  // Tax outstanding > 10L = moderate risk
  if (kpi.tax.total > 15) score -= 8;
  else if (kpi.tax.total > 8) score -= 4;

  return Math.max(0, Math.min(100, score));
}

export default async function DashboardPage() {
  const { profile } = await requireAuth();
  const healthScore = computeHealthScore(SAMPLE_KPI);

  return (
    <>
      <Header
        title="CFO Dashboard"
        breadcrumbs={[{ label: "Dashboard" }]}
        showImport={true}
        importModule="transactions"
      />

      <main className="flex-1 p-6 space-y-5">

        {/* ── Demo-data notice — shown until real data is imported ─────── */}
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

        {/* ── 1. Business Health Banner ─────────────────────────────────── */}
        <HealthBanner kpi={SAMPLE_KPI} healthScore={healthScore} />

        {/* ── 2. KPI Tiles ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">

          {/* Row 1 */}
          <KpiCard
            title="Revenue MTD"
            period="Mar 2026"
            value="₹1.84 Cr"
            trend="up"
            trendText="+7% vs Feb"
            href="/dashboard/drill/revenue"
          />
          <KpiCard
            title="COGS MTD"
            period="Mar 2026"
            value="₹1.12 Cr"
            trend="up"
            trendText="+5% vs Feb"
            href="/dashboard/drill/cogs"
          />
          <KpiCard
            title="Gross Margin"
            period="Mar 2026"
            value="39.1%"
            trend="up"
            trendText="+1.2pp vs Feb"
            href="/dashboard/drill/gross-margin"
          />
          <KpiCard
            title="Cash Balance"
            period="As of today"
            value="₹28.4 L"
            trend="down"
            trendText="−3.2% vs Feb"
            href="/dashboard/drill/cash"
          />

          {/* Row 2 */}
          <KpiCard
            title="AP Outstanding"
            value="₹46.5 L"
            subtext="Accounts Payable"
            alertText="₹16.95L overdue"
            href="/dashboard/payables"
          />
          <KpiCard
            title="AR Outstanding"
            value="₹68.35 L"
            subtext="Accounts Receivable"
            alertText="₹22.5L overdue"
            href="/dashboard/receivables"
          />
          <KpiCard
            title="Tax Liability"
            value="₹6.96 L"
            trend="neutral"
            trendText="GST + TDS pending"
            href="/dashboard/drill/tax"
          />
          <KpiCard
            title="OpEx MTD"
            period="Mar 2026"
            value="₹34.2 L"
            trend="up"
            trendText="+2.1% vs Feb"
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
