/**
 * Sales OS — Reports & Analytics.
 * Zoho/Odoo-style sales dashboard: funnel, conversion, win/loss, pipeline by
 * stage, rep leaderboard, lead-source performance, lead types, lost reasons,
 * and activity volume. For managers, sales heads, and leadership.
 */
import { Header } from "@/components/layout/header";
import { getSalesAnalytics } from "@/lib/crm/analytics";
import { AnalyticsCharts } from "@/components/crm/analytics-charts";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const data = await getSalesAnalytics();

  return (
    <>
      <Header
        title="Reports & Analytics"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Reports & Analytics" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-6xl">
        <AnalyticsCharts data={data} />
      </main>
    </>
  );
}
