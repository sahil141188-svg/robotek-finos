/**
 * Customer Ledger Drill-Down — Module 6 Layer 3
 *
 * Shows all outstanding invoices for a single customer.
 * RULE 2: Three-layer drill — Dashboard → AR Summary → Customer Ledger
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import {
  SAMPLE_CUSTOMERS, getCustomerInvoices, customerTotal, customerOverdue,
  COLLECTION_STATUS_META, fmtAmt, fmtD,
} from "@/lib/receivables-data";
import {
  ArrowLeft, Phone, Mail, AlertTriangle, CheckCircle2, Users,
  CreditCard, MessageSquare,
} from "lucide-react";

export async function generateStaticParams() {
  return SAMPLE_CUSTOMERS.map((c) => ({ customerId: c.id }));
}

export default async function CustomerDrillPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;
  const customer = SAMPLE_CUSTOMERS.find((c) => c.id === customerId);
  if (!customer) notFound();

  const invoices   = getCustomerInvoices(customer.id);
  const total      = customerTotal(customer);
  const overdue    = customerOverdue(customer);
  const isCritical = customer.ag90plus > 0;

  const STATUS_META: Record<string, { label: string; className: string }> = {
    outstanding:    { label: "Outstanding", className: "bg-blue-100 text-blue-700 border-blue-200" },
    overdue:        { label: "Overdue",     className: "bg-red-100 text-red-700 border-red-200" },
    partially_paid: { label: "Partial",     className: "bg-amber-100 text-amber-700 border-amber-200" },
    paid:           { label: "Paid",        className: "bg-green-100 text-green-700 border-green-200" },
  };

  // Credit utilisation
  const utilPct = customer.credit_limit > 0
    ? Math.min(100, Math.round((total / customer.credit_limit) * 100))
    : 0;
  const utilColor = utilPct >= 90 ? "bg-red-500" : utilPct >= 70 ? "bg-amber-500" : "bg-green-500";

  return (
    <>
      <Header
        title={customer.name}
        breadcrumbs={[
          { label: "Dashboard",            href: "/dashboard" },
          { label: "Accounts Receivable",  href: "/dashboard/receivables" },
          { label: customer.name.substring(0, 30) },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-4xl space-y-5">
        <Link
          href="/dashboard/receivables"
          className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Accounts Receivable
        </Link>

        {/* Customer header card */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-gray-light flex items-center justify-center shrink-0">
                <Users className="w-6 h-6 text-brand-gray-mid" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-brand-black">{customer.name}</h1>
                <p className="text-sm text-brand-gray-mid">{customer.segment}</p>
              </div>
            </div>
            {isCritical && (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5" /> Critical — 90+ days overdue
              </div>
            )}
          </div>

          {/* Contact row */}
          <div className="flex flex-wrap gap-4 text-xs text-brand-gray-mid pt-1 border-t border-border">
            {customer.contact_person && <span className="font-medium text-brand-black">{customer.contact_person}</span>}
            {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</span>}
            {customer.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</span>}
            {customer.gstin && <span>GSTIN: <code className="font-mono">{customer.gstin}</code></span>}
            <span>Payment Terms: {customer.payment_terms_days} days</span>
          </div>

          {/* Credit limit utilisation */}
          {customer.credit_limit > 0 && (
            <div className="pt-1 border-t border-border space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-brand-gray-mid">
                  <CreditCard className="w-3 h-3" /> Credit limit: <span className="font-medium text-brand-black">{fmtAmt(customer.credit_limit)}</span>
                </span>
                <span className={`font-semibold ${utilPct >= 90 ? "text-red-700" : utilPct >= 70 ? "text-amber-700" : "text-green-700"}`}>
                  {utilPct}% utilised
                </span>
              </div>
              <div className="h-2 bg-brand-gray-light rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${utilColor} transition-all`} style={{ width: `${utilPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Aging summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "0–30 Days",  value: customer.ag0to30,  className: "bg-green-50 border-green-200 text-green-800",   badge: "Current" },
            { label: "31–60 Days", value: customer.ag31to60, className: customer.ag31to60 > 0 ? "bg-amber-50 border-amber-200 text-amber-800"  : "bg-white border-border text-brand-gray-mid" },
            { label: "61–90 Days", value: customer.ag61to90, className: customer.ag61to90 > 0 ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-white border-border text-brand-gray-mid" },
            { label: "90+ Days",   value: customer.ag90plus, className: customer.ag90plus > 0 ? "bg-red-50 border-red-200 text-red-800"         : "bg-white border-border text-brand-gray-mid" },
          ].map(({ label, value, className }) => (
            <div key={label} className={`rounded-xl border p-4 ${className}`}>
              <p className="text-xs font-medium mb-1 opacity-80">{label}</p>
              <p className="text-xl font-bold">{value > 0 ? fmtAmt(value) : "—"}</p>
            </div>
          ))}
        </div>

        {/* Last receipt info */}
        {customer.last_payment_date && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              Last receipt: <strong>{fmtAmt(customer.last_payment_amount ?? 0)}</strong> on {fmtD(customer.last_payment_date)}
            </p>
          </div>
        )}

        {/* Collection notes */}
        {customer.collection_notes && (
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${
            isCritical
              ? "bg-red-50 border-red-200"
              : overdue > 0
              ? "bg-amber-50 border-amber-200"
              : "bg-blue-50 border-blue-200"
          }`}>
            <MessageSquare className={`w-4 h-4 shrink-0 mt-0.5 ${
              isCritical ? "text-red-600" : overdue > 0 ? "text-amber-600" : "text-blue-600"
            }`} />
            <p className={`text-sm ${
              isCritical ? "text-red-800" : overdue > 0 ? "text-amber-800" : "text-blue-800"
            }`}>
              <strong>Collection note:</strong> {customer.collection_notes}
            </p>
          </div>
        )}

        {/* Invoice list */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-black">Outstanding Invoices</h3>
            <span className="text-xs text-brand-gray-mid">{invoices.length} invoices · {fmtAmt(total)} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-brand-gray-light/50">
                  {["Invoice No", "Invoice Date", "Due Date", "Days Out", "Amount", "Status", "Collection"].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-2.5 text-xs font-medium text-brand-gray-mid ${h === "Amount" ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => {
                  const sm    = STATUS_META[inv.status];
                  const csm   = COLLECTION_STATUS_META[(inv.collection_status ?? inv.status) as keyof typeof COLLECTION_STATUS_META];
                  const isCrit = inv.days_outstanding >= 90;
                  const isWarn = inv.days_outstanding >= 30;
                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-brand-gray-light/30 ${isCrit ? "bg-red-50/30" : isWarn ? "bg-amber-50/30" : ""}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-brand-black">{inv.invoice_no}</td>
                      <td className="px-4 py-3 text-brand-gray-mid text-xs">{fmtD(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-brand-gray-mid text-xs">{fmtD(inv.due_date)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${isCrit ? "text-red-700" : isWarn ? "text-amber-700" : "text-brand-gray-mid"}`}>
                          {inv.days_outstanding}d
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-brand-black">{fmtAmt(inv.amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${sm.className}`}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${csm.className}`}>
                          {csm.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-brand-gray-light font-semibold">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-brand-gray-mid uppercase tracking-wide">Total Outstanding</td>
                  <td className="px-4 py-2.5 text-right text-brand-black">{fmtAmt(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
