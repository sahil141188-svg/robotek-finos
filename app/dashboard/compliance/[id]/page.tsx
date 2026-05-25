/**
 * Compliance Item Detail Page — Module 3
 *
 * Shows full details for a single compliance item:
 *   - Status, due date, period, forms required
 *   - Late fee / penalty information
 *   - Filed details (ack number, filed date)
 *   - Inline status update form
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/compliance/status-badge";
import { ComplianceDetailActions } from "@/components/compliance/compliance-detail-actions";
import {
  CATEGORY_META,
  fmtDate,
  daysFromToday,
} from "@/lib/compliance-data";
import { getComplianceItems } from "@/app/actions/compliance";
import {
  ArrowLeft, Calendar, FileText, AlertTriangle,
  CheckCircle2, Clock, Info,
} from "lucide-react";

// Bug #21 fix: remove generateStaticParams — static build snapshots the page
// at build time so DB updates (filed, paid) are never reflected.
// force-dynamic ensures every visit re-fetches from DB.
export const dynamic = "force-dynamic";

// Dynamic today — never hardcode a date string or overdue detection breaks
const TODAY = new Date().toISOString().slice(0, 10);

export default async function ComplianceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Bug #7 fix: load live items (DB merged with seed data) instead of
  // reading COMPLIANCE_ITEMS directly — filed/paid state was always stale.
  const items = await getComplianceItems();
  const item = items.find((i) => i.id === id);
  if (!item) notFound();

  const days    = daysFromToday(item.due_date, TODAY);
  const isDone  = item.status === "filed" || item.status === "paid";
  const catMeta = CATEGORY_META[item.category];

  const urgencyText = isDone
    ? item.filed_date ? `Completed ${fmtDate(item.filed_date)}` : "Completed"
    : days < 0
    ? `${Math.abs(days)} days overdue`
    : days === 0 ? "Due today!"
    : `${days} days remaining`;

  const urgencyClass = isDone
    ? "text-green-700"
    : days < 0 ? "text-red-700"
    : days <= 7 ? "text-amber-700"
    : "text-brand-gray-mid";

  return (
    <>
      <Header
        title={item.title}
        breadcrumbs={[
          { label: "Dashboard",   href: "/dashboard" },
          { label: "Compliance",  href: "/dashboard/compliance" },
          { label: item.title },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-3xl space-y-5">

        {/* Back */}
        <Link
          href="/dashboard/compliance"
          className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Compliance Calendar
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${catMeta.bg} ${catMeta.text} ${catMeta.border}`}>
              {catMeta.icon} {catMeta.label}
            </span>
            <StatusBadge status={item.status} />
            <span className={`text-sm font-medium ${urgencyClass}`}>{urgencyText}</span>
          </div>

          <div>
            <h1 className="text-xl font-bold text-brand-black">{item.title}</h1>
            <p className="text-sm text-brand-gray-mid mt-1">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
            <InfoTile icon={<Calendar className="w-4 h-4 text-brand-red" />} label="Due Date" value={fmtDate(item.due_date)} />
            <InfoTile icon={<Clock className="w-4 h-4 text-brand-red" />} label="Period" value={item.period} />
            <InfoTile icon={<FileText className="w-4 h-4 text-brand-red" />} label="Forms" value={item.forms.join(", ")} />
            <InfoTile icon={<Info className="w-4 h-4 text-brand-red" />} label="FY" value={item.financial_year} />
          </div>
        </div>

        {/* Filed / paid info */}
        {isDone && (
          <div className="bg-green-50 rounded-xl border border-green-200 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <h3 className="text-sm font-semibold text-green-800">Filing Details</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {item.filed_date && (
                <InfoTile label="Filed / Paid On" value={fmtDate(item.filed_date)} />
              )}
              {item.acknowledgement_number && (
                <InfoTile label="Ack / Ref Number" value={item.acknowledgement_number} />
              )}
            </div>
            {item.notes && (
              <p className="text-xs text-green-700 bg-green-100 rounded-lg px-3 py-2">{item.notes}</p>
            )}
          </div>
        )}

        {/* Late fee warning */}
        {!isDone && (
          <div className={`rounded-xl border p-5 space-y-2 ${days < 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${days < 0 ? "text-red-600" : "text-amber-600"}`} />
              <h3 className={`text-sm font-semibold ${days < 0 ? "text-red-800" : "text-amber-800"}`}>
                Late Fee / Penalty
              </h3>
            </div>
            <p className={`text-sm ${days < 0 ? "text-red-700" : "text-amber-700"}`}>{item.late_fee}</p>
            {days < 0 && (
              <p className="text-xs text-red-600 font-medium">
                Currently {Math.abs(days)} days overdue — file immediately to limit penalty accumulation.
              </p>
            )}
          </div>
        )}

        {/* Amount due */}
        {item.amount_due !== null && !isDone && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-2">Estimated Amount</h3>
            <p className="text-2xl font-bold text-brand-black">
              ₹{(item.amount_due / 100000).toFixed(2)}L
            </p>
            <p className="text-xs text-brand-gray-mid mt-1">
              Based on FY 2025-26 actuals — actual liability may vary
            </p>
          </div>
        )}

        {/* Notes */}
        {item.notes && !isDone && (
          <div className="bg-brand-gray-light rounded-xl border border-border p-4">
            <h3 className="text-xs font-semibold text-brand-black uppercase tracking-wide mb-2">Notes</h3>
            <p className="text-sm text-brand-gray-mid">{item.notes}</p>
          </div>
        )}

        {/* Status update form */}
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-brand-black mb-4">Update Status</h3>
          <ComplianceDetailActions item={item} />
        </div>

      </main>
    </>
  );
}

function InfoTile({
  icon, label, value,
}: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="text-[10px] font-medium text-brand-gray-mid uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-semibold text-brand-black">{value}</p>
    </div>
  );
}
