/**
 * Compliance Calendar Page — Module 3
 *
 * Server component: loads all compliance items and renders the interactive
 * ComplianceContent client component.
 *
 * RULE 1: Every item is clickable → /dashboard/compliance/[id]
 * RULE 6: Financial year April–March
 */

import { Header } from "@/components/layout/header";
import { ComplianceContent } from "@/components/compliance/compliance-content";
import { COMPLIANCE_ITEMS, computeComplianceScore } from "@/lib/compliance-data";
import { ShieldCheck } from "lucide-react";

// Dynamic today — never hardcode a date string or overdue detection breaks
const TODAY = new Date().toISOString().slice(0, 10);

export default function CompliancePage() {
  const items = COMPLIANCE_ITEMS;
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

      <main className="flex-1 p-6 space-y-6 max-w-6xl">

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
                FY 2026-27 · {items.length} total items · {overdue} overdue · All Indian statutory deadlines tracked
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
