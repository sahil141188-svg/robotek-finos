/**
 * Compliance Calendar Page — Module 3
 *
 * Bug #6 fix: was using static COMPLIANCE_ITEMS directly — any status updates
 * the user persisted (filed, paid) were invisible on the list page because the
 * DB was never queried.  Now calls getComplianceItems() which merges DB state
 * onto the seed data.
 */

import { Header } from "@/components/layout/header";
import { ComplianceContent } from "@/components/compliance/compliance-content";
import { getComplianceItems, } from "@/app/actions/compliance";
import { computeComplianceScore } from "@/lib/compliance-data";
import { ShieldCheck } from "lucide-react";

const TODAY = new Date().toISOString().slice(0, 10);

export default async function CompliancePage() {
  // Bug #6 fix: fetch live items (DB merged with seed data)
  const items = await getComplianceItems();

  const score = computeComplianceScore(items, TODAY);
  const overdue = items.filter(
    (i) => i.status === "overdue" || (i.due_date < TODAY && i.status === "pending"),
  ).length;

  const scoreBg =
    score >= 90 ? "bg-green-50 border-green-200 text-green-800"
    : score >= 70 ? "bg-amber-50 border-amber-200 text-amber-800"
    : "bg-red-50 border-red-200 text-red-800";
  const scoreLabel = score >= 90 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Needs Attention" : "Critical";

  return (
    <>
      <Header
        title="Compliance Calendar"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Compliance" },
        ]}
        showImport
        importModule="compliance"
      />

      <main className="flex-1 p-4 sm:p-6 space-y-5 max-w-6xl pb-8">

        {/* Compliance health bar */}
        <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${scoreBg}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Compliance Score: {score}% — {scoreLabel}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {items.length} total items · {overdue} overdue · All Indian statutory deadlines tracked
              </p>
            </div>
          </div>
          {overdue > 0 && (
            <div className="sm:ml-auto shrink-0 bg-red-100 border border-red-300 text-red-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
              ⚠️ {overdue} item{overdue > 1 ? "s" : ""} overdue — action required
            </div>
          )}
        </div>

        <ComplianceContent items={items} />
      </main>
    </>
  );
}
