/**
 * Review Engine — Module 7
 *
 * Server component shell. Renders the ReviewContent client component
 * which handles period switching (Weekly / Monthly / Quarterly) + PDF export.
 *
 * Bug #13 fix: fetches live KPI data and builds a real scorecard instead of
 * always showing the static 0/100 placeholder.
 *
 * RULE 1: Every metric is clickable — drills to source module
 * RULE 5: Indian number format throughout
 */

import { Header } from "@/components/layout/header";
import { ReviewContent } from "@/components/review/review-content";
import { fetchDashboardKPIs } from "@/app/actions/dashboard-kpis";
import { buildScorecardFromKPI } from "@/lib/review-data";
import { AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  // Bug #13 fix: fetch real KPI data for the scorecard
  const liveKPI = await fetchDashboardKPIs();
  const liveData = liveKPI ? buildScorecardFromKPI(liveKPI) : undefined;

  // Show banner when no Busy accounting data has been imported yet
  const hasBusyData = liveKPI != null && (liveKPI.revenue.current > 0 || liveKPI.cogs.current > 0);

  return (
    <>
      <Header
        title="Review Engine"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Review Engine" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-6xl">
        {!hasBusyData && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <strong>No accounting data imported yet.</strong> The Review Engine scores are based on your Busy accounting exports (revenue, COGS, expenses).{" "}
              <a href="/dashboard/import?module=transactions" className="underline font-semibold">
                Import your Day Book →
              </a>
              {" "}Bank statement data is already shown on the{" "}
              <a href="/dashboard/banking" className="underline font-semibold">Banking Dashboard</a>.
            </div>
          </div>
        )}
        <ReviewContent liveData={liveData} />
      </main>
    </>
  );
}
