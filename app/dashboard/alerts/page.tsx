/**
 * Smart Alerts — Module 8
 *
 * Real-data alert feed generated from compliance, AP, AR, and task data.
 * Sorted by priority (critical → high → medium → low).
 */

import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { getAllAlerts, alertCounts, PRIORITY_META, CATEGORY_META_ALERTS } from "@/lib/alerts-data";
import { AlertsClient } from "@/components/alerts/alerts-client";
import { AlertTriangle, Bell, TrendingDown, TrendingUp, CheckSquare, ShieldAlert } from "lucide-react";

function StatTile({
  label, count, cls,
}: { label: string; count: number; cls: string }) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col items-center justify-center gap-1 ${cls}`}>
      <p className="text-2xl font-extrabold leading-none">{count}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  );
}


export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  await requireAuth();

  const alerts = getAllAlerts();
  const counts = alertCounts();

  return (
    <>
      <Header
        title="Smart Alerts"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Alerts" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl space-y-5">

        {/* Summary stat tiles */}
        <div className="grid grid-cols-4 sm:grid-cols-4 gap-3">
          <StatTile label="Critical"  count={counts.critical} cls="bg-red-50 border-red-200 text-red-700" />
          <StatTile label="High"      count={counts.high}     cls="bg-orange-50 border-orange-200 text-orange-700" />
          <StatTile label="Medium"    count={counts.medium}   cls="bg-amber-50 border-amber-200 text-amber-700" />
          <StatTile label="Low"       count={counts.low}      cls="bg-blue-50 border-blue-200 text-blue-700" />
        </div>

        {/* Category summary strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { cat: "compliance", icon: ShieldAlert,  label: "Compliance", count: counts.compliance, color: "text-purple-700" },
            { cat: "ap",         icon: TrendingDown, label: "AP / Payables", count: counts.ap, color: "text-red-700" },
            { cat: "ar",         icon: TrendingUp,   label: "AR / Receivables", count: counts.ar, color: "text-blue-700" },
            { cat: "tasks",      icon: CheckSquare,  label: "Tasks", count: counts.tasks, color: "text-green-700" },
          ].map(({ cat, icon: Icon, label, count, color }) => (
            <div key={cat} className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
              <Icon className={`w-5 h-5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs text-brand-gray-mid">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{count} alert{count !== 1 ? "s" : ""}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive alert list (client component for dismiss/filter) */}
        <AlertsClient alerts={alerts} />

      </main>
    </>
  );
}
