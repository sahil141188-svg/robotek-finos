"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setPriority } from "@/app/actions/crm-chatter";
import { updateLeadDocs, transferToFunnel } from "@/app/actions/crm";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, ACTIVITY_TYPE_LABELS } from "@/lib/crm/types";
import { LEAD_TYPE_LABELS } from "@/lib/crm/drip";
import { formatIndian } from "@/lib/format";
import type { LeadDetail } from "@/lib/crm/detail";
import { Chatter } from "./chatter";
import { Phone, Mail, Tag, Star, ArrowRight, CheckSquare, Square, FileText } from "lucide-react";

const PRIORITIES = ["COLD", "MEDIUM", "HOT"];
const PRIORITY_COLORS: Record<string, string> = {
  HOT: "bg-red-100 text-red-700", MEDIUM: "bg-amber-100 text-amber-700", COLD: "bg-blue-100 text-blue-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function LeadDetailView({ detail }: { detail: LeadDetail }) {
  const router = useRouter();
  const { lead, activities, messages } = detail;
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const leadAny = lead as {
    shop_photo_ok?: boolean;
    visiting_card_ok?: boolean;
    gst_number?: string | null;
    dream_customer?: boolean;
    enquiry_no?: string | null;
    enquiry_type?: string | null;
    sc_name?: string | null;
    product_interest?: string | null;
    existing_brand?: string | null;
    monthly_turnover?: string | null;
    investment_amount?: string | null;
    priority?: string | null;
  };

  const [shopPhoto, setShopPhoto] = useState(leadAny.shop_photo_ok ?? false);
  const [visitingCard, setVisitingCard] = useState(leadAny.visiting_card_ok ?? false);
  const [gstNumber, setGstNumber] = useState(leadAny.gst_number ?? "");
  const docsAllDone = shopPhoto && visitingCard && !!gstNumber.trim();

  function changePriority(p: string) {
    start(async () => { await setPriority("lead", lead.id, p); router.refresh(); });
  }

  function saveDocs() {
    start(async () => {
      const r = await updateLeadDocs(lead.id, { shop_photo_ok: shopPhoto, visiting_card_ok: visitingCard, gst_number: gstNumber });
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      router.refresh();
    });
  }

  function handleTransfer() {
    start(async () => {
      const r = await transferToFunnel(lead.id);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      router.refresh();
    });
  }

  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Phone", value: lead.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span> : "—" },
    { label: "Email", value: lead.email ? <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span> : "—" },
    { label: "Location", value: [lead.city, lead.state].filter(Boolean).join(", ") || "—" },
    { label: "Lead type", value: LEAD_TYPE_LABELS[lead.lead_type] },
    { label: "Source", value: lead.source ?? "—" },
    { label: "Enquiry no.", value: leadAny.enquiry_no ?? "—" },
    { label: "Enquiry type", value: leadAny.enquiry_type ?? "—" },
    { label: "SC", value: leadAny.sc_name ?? lead.assigned_name ?? "—" },
    { label: "Product interest", value: leadAny.product_interest ?? "—" },
    { label: "Existing brand", value: leadAny.existing_brand ?? "—" },
    { label: "Monthly turnover", value: leadAny.monthly_turnover ?? "—" },
    { label: "Investment", value: leadAny.investment_amount ?? "—" },
    { label: "Est. value", value: lead.est_value ? formatIndian(lead.est_value, 0) : "—" },
  ];

  const isConverted = lead.status === "converted";
  const canTransfer = lead.status === "qualified" && docsAllDone && !isConverted;

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-brand-black flex items-center gap-2">
              {lead.name}
              {leadAny.dream_customer && <Star className="w-4 h-4 text-brand-yellow fill-brand-yellow" />}
            </h2>
            {lead.company && <div className="text-sm text-brand-gray-mid">{lead.company}</div>}
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`text-xs rounded-full px-2.5 py-1 font-medium ${LEAD_STATUS_COLORS[lead.status]}`}>{LEAD_STATUS_LABELS[lead.status]}</span>
              {lead.converted_account_id && <Link href={`/dashboard/sales-os/accounts/${lead.converted_account_id}`} className="text-xs text-brand-red hover:underline">View account →</Link>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-brand-gray-mid" />
            {PRIORITIES.map((p) => (
              <button key={p} onClick={() => changePriority(p)} disabled={pending}
                className={`text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors ${leadAny.priority === p ? PRIORITY_COLORS[p] : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          {fields.map((f) => (
            <div key={f.label}>
              <div className="text-[11px] text-brand-gray-mid">{f.label}</div>
              <div className="text-brand-black mt-0.5">{f.value}</div>
            </div>
          ))}
        </div>

        {(lead.tags ?? []).length > 0 && (
          <div className="mt-3 flex items-center gap-1 flex-wrap">
            {(lead.tags ?? []).map((t) => <span key={t} className="text-[10px] bg-purple-100 text-purple-700 rounded-full px-2 py-0.5">{t}</span>)}
          </div>
        )}
        {lead.notes && <p className="mt-3 text-sm text-brand-gray-mid whitespace-pre-wrap">{lead.notes}</p>}
      </div>

      {/* Docs collection — required before Transfer to Funnel */}
      {!isConverted && (
        <div className={`rounded-xl border p-5 ${docsAllDone ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-brand-black flex items-center gap-1.5">
              <FileText className="w-4 h-4" /> Document Collection
            </h3>
            {docsAllDone && <span className="text-xs font-medium text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">All docs received ✓</span>}
          </div>

          <div className="space-y-2 mb-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={() => setShopPhoto((v) => !v)} disabled={pending} className="text-emerald-600 disabled:opacity-60">
                {shopPhoto ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-brand-gray-mid" />}
              </button>
              <span className="text-sm text-brand-black">Shop Photo received</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={() => setVisitingCard((v) => !v)} disabled={pending} className="text-emerald-600 disabled:opacity-60">
                {visitingCard ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-brand-gray-mid" />}
              </button>
              <span className="text-sm text-brand-black">Visiting Card received</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-brand-gray-mid mb-1 block">GST Number</span>
              <input
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                disabled={pending}
                placeholder="e.g. 07AAACR5055K1Z5"
                maxLength={15}
                className="w-full max-w-xs rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveDocs}
              disabled={pending}
              className="px-3 py-2 border border-border rounded-lg text-xs font-medium text-brand-black hover:bg-white disabled:opacity-60 transition-colors"
            >
              {pending ? "Saving…" : "Save Docs"}
            </button>
            <button
              onClick={handleTransfer}
              disabled={pending || !canTransfer}
              title={!canTransfer ? (lead.status !== "qualified" ? "Mark lead as Qualified first" : "Save all 3 docs first") : "Transfer to Sales Funnel"}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-xs font-medium hover:bg-brand-maroon disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Transfer to Funnel <ArrowRight className="w-3.5 h-3.5" />
            </button>
            {!canTransfer && (
              <span className="text-xs text-brand-gray-mid">
                {lead.status !== "qualified" ? "Lead must be Qualified" : "All docs required"}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Activities */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-brand-black mb-3">Activities</h3>
        {activities.length === 0 ? <p className="text-sm text-brand-gray-mid">No activities.</p> : (
          <div className="divide-y divide-border">
            {activities.map((a) => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <span className={a.done ? "line-through text-brand-gray-mid" : "text-brand-black"}>
                  <span className="text-[10px] uppercase bg-brand-gray-light rounded px-1.5 py-0.5 mr-2 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[a.type]}</span>
                  {a.subject}
                </span>
                <span className="text-xs text-brand-gray-mid">{a.due_at ? fmtDate(a.due_at) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Chatter parentType="lead" parentId={lead.id} messages={messages} />
    </div>
  );
}
