/**
 * Accounts Payable Health — Module 5
 *
 * Server component: loads vendor aging data, renders interactive VendorTable.
 * RULE 1: Every vendor name links to /dashboard/payables/[vendorId]
 * RULE 5: Indian number format (Lakhs / Crores)
 */

import { Header } from "@/components/layout/header";
import { VendorTable } from "@/components/payables/vendor-table";
import { SAMPLE_VENDORS, AP_SUMMARY, fmtAmt } from "@/lib/payables-data";
import { TrendingDown, AlertTriangle, Clock, Building2, Upload } from "lucide-react";

export default function PayablesPage() {
  const { total, overdue, avg_dpo, vendors, bucket0to30, bucket31to60, bucket61to90, bucket90plus } = AP_SUMMARY;
  // Guard against division by zero when no data imported yet
  const overduePercent = total > 0 ? Math.round((overdue / total) * 100) : 0;

  return (
    <>
      <Header
        title="Accounts Payable"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Accounts Payable" },
        ]}
        showImport
        importModule="payables"
      />

      <main className="flex-1 p-6 space-y-6 max-w-6xl">

        {/* ── KPI tiles ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile
            icon={<TrendingDown className="w-5 h-5 text-brand-red" />}
            label="Total Outstanding" value={fmtAmt(total)}
            sub={`${vendors} vendors`}
            className="bg-white border-border"
          />
          <KpiTile
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            label="Overdue (>30 days)" value={fmtAmt(overdue)}
            sub={`${overduePercent}% of total AP`}
            className="bg-red-50 border-red-200"
            valueClass="text-red-700"
          />
          <KpiTile
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            label="Avg DPO" value={`${avg_dpo} days`}
            sub="Days Payable Outstanding"
            className="bg-amber-50 border-amber-200"
          />
          <KpiTile
            icon={<Building2 className="w-5 h-5 text-blue-600" />}
            label="Vendors" value={`${vendors}`}
            sub="Active vendor accounts"
            className="bg-blue-50 border-blue-200"
          />
        </div>

        {/* ── Aging summary bars ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-brand-black mb-4">Aging Breakdown — {fmtAmt(total)} total</h3>
          <div className="space-y-2.5">
            <AgingBar label="0–30 Days"   value={bucket0to30}  total={total} color="bg-green-500"  textClass="text-green-700" />
            <AgingBar label="31–60 Days"  value={bucket31to60} total={total} color="bg-amber-500"  textClass="text-amber-700" />
            <AgingBar label="61–90 Days"  value={bucket61to90} total={total} color="bg-orange-500" textClass="text-orange-700" />
            <AgingBar label="90+ Days"    value={bucket90plus} total={total} color="bg-red-600"    textClass="text-red-700" />
          </div>
        </div>

        {/* ── Empty state CTA — shown when no AP data imported yet ──── */}
        {total === 0 && vendors === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-brand-red/30 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-red/10 flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6 text-brand-red" />
            </div>
            <div>
              <p className="text-sm font-semibold text-brand-black">No vendor data imported yet</p>
              <p className="text-xs text-brand-gray-mid mt-1">
                Export your vendor outstanding / aging report from Busy:<br />
                Busy → Reports → Payables → Vendor Outstanding → Export Excel
              </p>
            </div>
            <a
              href="/dashboard/import?module=payables"
              className="inline-flex items-center gap-1.5 h-8 rounded-lg px-4 text-xs font-semibold bg-brand-red hover:bg-brand-maroon text-white transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Import AP Data
            </a>
          </div>
        )}

        {/* ── Vendor table ─────────────────────────────────────────────── */}
        <VendorTable vendors={SAMPLE_VENDORS} />

      </main>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({ icon, label, value, sub, className, valueClass = "text-brand-black" }: {
  icon: React.ReactNode; label: string; value: string;
  sub: string; className?: string; valueClass?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-xs font-medium text-brand-gray-mid">{label}</p>
      </div>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
      <p className="text-xs text-brand-gray-mid">{sub}</p>
    </div>
  );
}

function AgingBar({ label, value, total, color, textClass }: {
  label: string; value: number; total: number; color: string; textClass: string;
}) {
  // Guard against division by zero when no data imported yet
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-brand-gray-mid w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-brand-gray-light rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-16 text-right ${textClass}`}>{fmtAmt(value)}</span>
      <span className="text-xs text-brand-gray-mid w-8 text-right">{pct}%</span>
    </div>
  );
}
