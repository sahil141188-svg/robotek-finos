"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setPriority } from "@/app/actions/crm-chatter";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, ACTIVITY_TYPE_LABELS } from "@/lib/crm/types";
import { LEAD_TYPE_LABELS } from "@/lib/crm/drip";
import { formatIndian } from "@/lib/format";
import type { LeadDetail } from "@/lib/crm/detail";
import { Chatter } from "./chatter";
import { Phone, Mail, MapPin, Tag, Star } from "lucide-react";

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

  function changePriority(p: string) {
    start(async () => { await setPriority("lead", lead.id, p); router.refresh(); });
  }

  // Render whichever of the rich enquiry fields are present.
  const fields: { label: string; value: React.ReactNode }[] = [
    { label: "Phone", value: lead.phone ? <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span> : "—" },
    { label: "Email", value: lead.email ? <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span> : "—" },
    { label: "Location", value: [lead.city, lead.state].filter(Boolean).join(", ") || "—" },
    { label: "Lead type", value: LEAD_TYPE_LABELS[lead.lead_type] },
    { label: "Source", value: lead.source ?? "—" },
    { label: "Enquiry no.", value: (lead as { enquiry_no?: string | null }).enquiry_no ?? "—" },
    { label: "Enquiry type", value: (lead as { enquiry_type?: string | null }).enquiry_type ?? "—" },
    { label: "SC", value: (lead as { sc_name?: string | null }).sc_name ?? lead.assigned_name ?? "—" },
    { label: "Product interest", value: (lead as { product_interest?: string | null }).product_interest ?? "—" },
    { label: "Existing brand", value: (lead as { existing_brand?: string | null }).existing_brand ?? "—" },
    { label: "Monthly turnover", value: (lead as { monthly_turnover?: string | null }).monthly_turnover ?? "—" },
    { label: "Investment", value: (lead as { investment_amount?: string | null }).investment_amount ?? "—" },
    { label: "Est. value", value: lead.est_value ? formatIndian(lead.est_value, 0) : "—" },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-brand-black flex items-center gap-2">
              {lead.name}
              {(lead as { dream_customer?: boolean }).dream_customer && <Star className="w-4 h-4 text-brand-yellow fill-brand-yellow" />}
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
                className={`text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors ${lead.priority === p ? PRIORITY_COLORS[p] : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>
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
