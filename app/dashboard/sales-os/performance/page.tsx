/**
 * Sales OS — Performance dashboard. Company + per-user actuals vs weekly
 * targets (follow-ups, meetings, conversions, value). Set targets inline.
 */
import { Header } from "@/components/layout/header";
import { requireAuth } from "@/lib/auth";
import { getPerformance, weekStartOf, addDaysISO } from "@/lib/crm/performance";
import { PerformanceClient } from "@/components/crm/performance-client";

export const dynamic = "force-dynamic";

function label(weekStart: string): string {
  const a = new Date(weekStart + "T00:00:00");
  const b = new Date(addDaysISO(weekStart, 6) + "T00:00:00");
  const f = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  return `Week of ${f(a)} – ${f(b)}`;
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { profile } = await requireAuth();
  const { week } = await searchParams;

  const thisWeek = weekStartOf(new Date());
  const weekStart = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : thisWeek;
  const data = await getPerformance(weekStart);
  const canManage = profile.permissions?.manage_crm !== false;

  return (
    <>
      <Header
        title="Performance"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Performance" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-6xl">
        <PerformanceClient
          data={data}
          canManage={canManage}
          weekLabel={label(weekStart)}
          prevWeek={addDaysISO(weekStart, -7)}
          nextWeek={addDaysISO(weekStart, 7)}
          thisWeek={thisWeek}
          isThisWeek={weekStart === thisWeek}
        />
      </main>
    </>
  );
}
