"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setQuoteStatus } from "@/app/actions/crm-quotes";
import { formatIndian } from "@/lib/format";
import type { QuoteDetail } from "@/lib/crm/quotes";
import type { CrmQuoteStatus } from "@/types/database";
import { Printer, Send, Check } from "lucide-react";

const STATUSES: CrmQuoteStatus[] = ["draft", "sent", "accepted", "rejected", "expired"];
const STATUS_COLORS: Record<CrmQuoteStatus, string> = {
  draft: "bg-brand-gray-light text-brand-gray-mid",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function QuoteView({ detail }: { detail: QuoteDetail }) {
  const router = useRouter();
  const { quote, items, account } = detail;
  const [pending, start] = useTransition();

  function changeStatus(s: CrmQuoteStatus) {
    start(async () => { await setQuoteStatus(quote.id, s); router.refresh(); });
  }

  const waText = `Quotation ${quote.quote_number}\nTotal: ${formatIndian(Number(quote.total) || 0, 0)} (incl. GST)\n${items.map((i) => `• ${i.description} ×${Number(i.qty)}`).join("\n")}`;
  let waHref: string | null = null;
  if (account?.phone) {
    let d = account.phone.replace(/\D/g, "");
    if (d.length === 10) d = "91" + d;
    waHref = `https://wa.me/${d}?text=${encodeURIComponent(waText)}`;
  }

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: "@media print { aside, header, .no-print { display: none !important; } main { padding: 0 !important; max-width: none !important; } .quote-doc { border: none !important; } }" }} />

      {/* Toolbar */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-brand-gray-mid">Status:</span>
          <select value={quote.status} onChange={(e) => changeStatus(e.target.value as CrmQuoteStatus)} disabled={pending}
            className={`text-xs rounded-full px-2.5 py-1 font-medium border-0 ${STATUS_COLORS[quote.status]}`}>
            {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          {waHref && <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 text-sm font-medium hover:bg-emerald-50"><Send className="w-4 h-4" /> WhatsApp</a>}
          <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-red text-white text-sm font-medium hover:bg-brand-maroon"><Printer className="w-4 h-4" /> Print / PDF</button>
        </div>
      </div>

      {/* Document */}
      <div className="quote-doc bg-white rounded-xl border border-border p-8 max-w-3xl mx-auto">
        <div className="flex items-start justify-between border-b border-border pb-5">
          <div>
            <div className="text-xl font-bold text-brand-red">Robotek India</div>
            <div className="text-xs text-brand-gray-mid mt-1">Mobile Accessories Manufacturer · Est. 2004</div>
            <div className="text-xs text-brand-gray-mid">Kundli, Haryana · HQ Delhi</div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-brand-black">QUOTATION</div>
            <div className="text-sm text-brand-gray-mid mt-1">{quote.quote_number}</div>
            <span className={`inline-block mt-2 text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[quote.status]}`}>{quote.status.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex items-start justify-between py-5 text-sm">
          <div>
            <div className="text-xs text-brand-gray-mid mb-1">Quotation for</div>
            <div className="font-semibold text-brand-black">{quote.account_name ?? "—"}</div>
            {account?.gstin && <div className="text-xs text-brand-gray-mid">GSTIN: {account.gstin}</div>}
            {account && (account.city || account.state) && <div className="text-xs text-brand-gray-mid">{[account.city, account.state].filter(Boolean).join(", ")}</div>}
            {account?.phone && <div className="text-xs text-brand-gray-mid">{account.phone}</div>}
          </div>
          <div className="text-right text-xs text-brand-gray-mid">
            <div>Date: {fmtDate(quote.created_at)}</div>
            <div>Valid until: {fmtDate(quote.valid_until)}</div>
            {quote.owner_name && <div>Prepared by: {quote.owner_name}</div>}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-border text-left text-xs text-brand-gray-mid">
              <th className="py-2 font-medium">#</th>
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 font-medium text-right">Qty</th>
              <th className="py-2 font-medium text-right">Rate</th>
              <th className="py-2 font-medium text-right">GST%</th>
              <th className="py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id} className="border-b border-border">
                <td className="py-2 text-brand-gray-mid">{i + 1}</td>
                <td className="py-2 text-brand-black">{it.description}</td>
                <td className="py-2 text-right tabular-nums">{Number(it.qty)}</td>
                <td className="py-2 text-right tabular-nums">{formatIndian(Number(it.unit_price) || 0, 0)}</td>
                <td className="py-2 text-right tabular-nums">{Number(it.gst_rate)}%</td>
                <td className="py-2 text-right tabular-nums">{formatIndian(Number(it.line_total) || 0, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end pt-4">
          <div className="w-56 space-y-1.5 text-sm">
            <Row label="Subtotal" value={formatIndian(Number(quote.subtotal) || 0, 0)} />
            <Row label="GST" value={formatIndian(Number(quote.tax_total) || 0, 0)} />
            <div className="border-t border-border pt-1.5"><Row label="Total" value={formatIndian(Number(quote.total) || 0, 0)} bold /></div>
          </div>
        </div>

        {quote.notes && <div className="mt-5 text-sm"><div className="text-xs text-brand-gray-mid mb-1">Notes</div><p className="text-brand-black">{quote.notes}</p></div>}
        {quote.terms && <div className="mt-4 text-xs text-brand-gray-mid border-t border-border pt-3"><div className="font-medium mb-1">Terms</div><p className="whitespace-pre-wrap">{quote.terms}</p></div>}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex items-center justify-between ${bold ? "font-bold text-brand-black text-base" : "text-brand-gray-mid"}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}
