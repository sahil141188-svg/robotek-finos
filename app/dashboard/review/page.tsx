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

export default async function ReviewPage() {
  // Bug #13 fix: fetch real KPI data for the scorecard
  const liveKPI = await fetchDashboardKPIs();
  const liveData = liveKPI ? buildScorecardFromKPI(liveKPI) : undefined;

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
        <ReviewContent liveData={liveData} />
      </main>
    </>
  );
}
