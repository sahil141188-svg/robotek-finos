/**
 * Vendor Ledger Drill-Down — Module 5 Layer 3
 *
 * Shows all outstanding invoices for a single vendor.
 * RULE 2: Three-layer drill — Dashboard → AP Summary → Vendor Ledger
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { fmtAmt, fmtD } from "@/lib/payables-data";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { buildPartyAging } from "@/lib/supabase/party-aging";
import { ArrowLeft, Phone, Mail, AlertTriangle, CheckCircle2, Building2 } from "lucide-react";

// Vendor IDs come from the DB at request time. Skip prerendering — this page
// is fully dynamic.
export const dynamic = "force-dynamic";

export default async function VendorDrillPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const supabase  = await createClient();
  const companyId = await getSelectedCompanyId();
  const { parties } = await buildPartyAging(supabase, "vendor", companyId);
  const vendor = parties.find((p) => p.party_id === vendorId);
  if (!vendor) notFound();

  const invoices = vendor.open_invoices;
  const total = vendor.total;
  const overdue = vendor.ag31to60 + vendor.ag61to90 + vendor.ag90plus;
  const isCritical = vendor.ag90plus > 0;

  const STATUS_META: Record<string, { label: string; className: string }> = {
    outstanding:     { label: "Outstanding",     className: "bg-blue-100 text-blue-700 border-blue-200" },
    overdue:         { label: "Overdue",         className: "bg-red-100 text-red-700 border-red-200" },
    partially_paid:  { label: "Partial",         className: "bg-amber-100 text-amber-700 border-amber-200" },
    paid:            { label: "Paid",            className: "bg-green-100 text-green-700 border-green-200" },
  };

  return (
    <>
      <Header
        title={vendor.party_name}
        breadcrumbs={[
          { label: "Dashboard",         href: "/dashboard" },
          { label: "Accounts Payable",  href: "/dashboard/payables" },
          { label: vendor.party_name.substring(0, 30) },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-4xl space-y-5">
        <Link href="/dashboard/payables" className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Accounts Payable
        </Link>

        {/* Vendor header card */}
        <div className="bg-white rounded-xl border border-border p-5 space-y-4">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-brand-gray-light flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6 text-brand-gray-mid" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-brand-black">{vendor.party_name}</h1>
                <p className="text-sm text-brand-gray-mid">Vendor</p>
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
            {vendor.contact_person && <span className="font-medium text-brand-black">{vendor.contact_person}</span>}
            {vendor.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {vendor.phone}</span>}
            {vendor.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {vendor.email}</span>}
            {vendor.gstin && <span>GSTIN: <code className="font-mono">{vendor.gstin}</code></span>}
            <span>Payment Terms: {vendor.payment_terms_days} days</span>
          </div>
        </div>

        {/* Aging summary tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "0–30 Days",   value: vendor.ag0to30,  className: "bg-green-50 border-green-200 text-green-800" },
            { label: "31–60 Days",  value: vendor.ag31to60, className: vendor.ag31to60 > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-white border-border text-brand-gray-mid" },
            { label: "61–90 Days",  value: vendor.ag61to90, className: vendor.ag61to90 > 0 ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-white border-border text-brand-gray-mid" },
            { label: "90+ Days",    value: vendor.ag90plus, className: vendor.ag90plus > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-white border-border text-brand-gray-mid" },
          ].map(({ label, value, className }) => (
            <div key={label} className={`rounded-xl border p-4 ${className}`}>
              <p className="text-xs font-medium mb-1 opacity-80">{label}</p>
              <p className="text-xl font-bold">{value > 0 ? fmtAmt(value) : "—"}</p>
            </div>
          ))}
        </div>

        {/* Last payment info */}
        {vendor.last_payment_date && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              Last payment: <strong>{fmtAmt(vendor.last_payment_amount ?? 0)}</strong> on {fmtD(vendor.last_payment_date)}
            </p>
          </div>
        )}

        {/* Invoice list */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-brand-gray-light flex items-center justify-between">
            <h3 className="text-sm font-semibold text-brand-black">Outstanding Invoices</h3>
            <span className="text-xs text-brand-gray-mid">{invoices.length} invoices · {fmtAmt(total)} total · {fmtAmt(overdue)} overdue</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-brand-gray-light/50">
                  {["Voucher", "Invoice Date", "Due Date", "Days Out", "Amount", "Status"].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-medium text-brand-gray-mid ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => {
                  const sm = STATUS_META[inv.status];
                  const isCrit = inv.days_outstanding >= 90;
                  const isWarn = inv.days_outstanding >= 30;
                  return (
                    <tr key={inv.id} className={`hover:bg-brand-gray-light/30 ${isCrit ? "bg-red-50/30" : isWarn ? "bg-amber-50/30" : ""}`}>
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
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-brand-gray-light font-semibold">
                  <td colSpan={4} className="px-4 py-2.5 text-xs text-brand-gray-mid uppercase tracking-wide">Total Outstanding</td>
                  <td className="px-4 py-2.5 text-right text-brand-black">{fmtAmt(total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </main>
    </>
  );
}
