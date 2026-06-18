"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createMetaLead, updateLeadStatus } from "@/app/actions/meta-leads";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS } from "@/lib/crm/types";
import type { MetaLead } from "@/lib/crm/meta-leads";
import type { CrmLeadStatus } from "@/types/database";
import { Plus, X, Phone, Mail, MessageSquare, FileText, Copy, CheckCircle, ExternalLink } from "lucide-react";

type SalesMember = { id: string; full_name: string };

const META_WA_NUMBER = "919625997436"; // +91 96259 97436 — E.164 without +

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const SOURCE_BADGE: Record<string, string> = {
  "Meta WhatsApp":   "bg-green-100 text-green-700",
  "Meta Lead Form":  "bg-blue-100 text-blue-700",
};

const ACTIVE_STATUSES: CrmLeadStatus[] = ["new", "contacted", "docs_pending", "qualified", "hold", "rejected"];

export function MetaLeadsClient({ leads, sales }: { leads: MetaLead[]; sales: SalesMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/webhooks/meta-leads`
    : "/api/webhooks/meta-leads";

  function copyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await createMetaLead(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      (e.target as HTMLFormElement).reset();
      setOpen(false);
      router.refresh();
    });
  }

  function changeStatus(id: string, status: CrmLeadStatus) {
    start(async () => { await updateLeadStatus(id, status); router.refresh(); });
  }

  const shown = sourceFilter === "all" ? leads : leads.filter((l) => l.source === sourceFilter);
  const waCount = leads.filter((l) => l.source === "Meta WhatsApp").length;
  const formCount = leads.filter((l) => l.source === "Meta Lead Form").length;

  return (
    <div className="space-y-4">

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Meta Leads", value: leads.length, color: "text-brand-black" },
          { label: "WhatsApp Leads",   value: waCount,      color: "text-green-700" },
          { label: "Lead Form Leads",  value: formCount,    color: "text-blue-700" },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-xl border border-border p-4">
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-brand-gray-mid mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Setup card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">Meta Ads Setup</h3>
            <p className="text-xs text-blue-700 mb-2">
              <strong>WhatsApp number:</strong>{" "}
              <a href={`https://wa.me/${META_WA_NUMBER}`} target="_blank" rel="noopener noreferrer"
                className="underline hover:text-blue-900 inline-flex items-center gap-0.5">
                +91 96259 97436 <ExternalLink className="w-3 h-3" />
              </a>
              {" "}— add this number as the Click-to-WhatsApp destination in your Meta Ad.
            </p>
            <p className="text-xs text-blue-700">
              <strong>Lead Form webhook:</strong> To auto-capture Meta Lead Form submissions, paste this URL in{" "}
              <span className="font-medium">Meta Business Suite → Leads Centre → Webhooks</span>:
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="text-[11px] bg-white border border-blue-200 rounded px-2 py-1 font-mono text-blue-900 break-all">
                {webhookUrl}
              </code>
              <button onClick={copyWebhook} className="shrink-0 inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900">
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-blue-600 mt-1.5">
              Verify token (set in Meta): <code className="font-mono bg-white border border-blue-200 rounded px-1">robotek_meta_2024</code>
              {" "}— also add <code className="font-mono bg-white border border-blue-200 rounded px-1">META_VERIFY_TOKEN=robotek_meta_2024</code> to Vercel env vars.
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {["all", "Meta WhatsApp", "Meta Lead Form"].map((s) => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={`text-xs rounded-full px-3 py-1.5 font-medium transition-colors ${sourceFilter === s ? "bg-brand-red text-white" : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>
              {s === "all" ? "All" : s === "Meta WhatsApp" ? "WhatsApp" : "Lead Forms"}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {open ? "Close" : "Add WhatsApp Lead"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* Quick-add form for Click-to-WhatsApp leads */}
      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3 text-xs text-brand-gray-mid flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-green-600" />
            Adding a lead that messaged <strong>+91 96259 97436</strong> via a Meta WhatsApp ad
          </div>
          <Field label="Name *"><input name="name" required className={inp} placeholder="Person or business" /></Field>
          <Field label="Phone"><input name="phone" className={inp} placeholder="+91 9XXXXXXXXX" /></Field>
          <Field label="Email"><input name="email" type="email" className={inp} /></Field>
          <Field label="Company"><input name="company" className={inp} /></Field>
          <Field label="City"><input name="city" className={inp} /></Field>
          <Field label="State"><input name="state" className={inp} /></Field>
          <Field label="Ad / Campaign name"><input name="ad_name" className={inp} placeholder="e.g. Summer Sale — Dealer" /></Field>
          <Field label="Est. Value (₹)"><input name="est_value" type="number" min="0" className={inp} /></Field>
          <Field label="Assign To">
            <select name="assigned_to" className={inp} defaultValue="">
              <option value="">Unassigned</option>
              {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Notes / First message from lead"><textarea name="notes" rows={2} className={inp} /></Field>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending}
              className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Save Meta Lead"}
            </button>
          </div>
        </form>
      )}

      {/* Leads table */}
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Ad</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-brand-gray-mid">
                {sourceFilter === "Meta WhatsApp" ? "No WhatsApp leads yet. Click “Add WhatsApp Lead” to add one." : sourceFilter === "Meta Lead Form" ? "No form leads yet. Connect the webhook above to auto-capture them." : "No Meta leads yet. Add a WhatsApp lead or connect the Meta Lead Form webhook above."}
              </td></tr>
            )}
            {shown.map((l) => (
              <Fragment key={l.id}>
                <tr className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                  <td className="px-4 py-3">
                    <a href={`/dashboard/sales-os/leads/${l.id}`} className="font-medium text-brand-black hover:text-brand-red">{l.name}</a>
                    {l.company && <div className="text-[10px] text-brand-gray-mid">{l.company}</div>}
                    <span className={`inline-block mt-0.5 text-[10px] rounded-full px-1.5 py-0.5 font-medium ${SOURCE_BADGE[l.source ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                      {l.source === "Meta WhatsApp" ? <span className="flex items-center gap-0.5"><MessageSquare className="w-2.5 h-2.5" />WA</span> : <span className="flex items-center gap-0.5"><FileText className="w-2.5 h-2.5" />Form</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-gray-mid">
                    {l.phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                          className="hover:text-green-700 hover:underline">{l.phone}</a>
                      </div>
                    )}
                    {l.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{l.email}</div>}
                    {[l.city, l.state].filter(Boolean).join(", ") && (
                      <div className="text-[10px]">{[l.city, l.state].filter(Boolean).join(", ")}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-brand-gray-mid">{l.ad_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-brand-gray-mid">{l.assigned_name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-brand-gray-mid">{fmtDate(l.created_at)}</td>
                  <td className="px-4 py-3">
                    <select value={l.status} disabled={pending || l.status === "converted"}
                      onChange={(e) => changeStatus(l.id, e.target.value as CrmLeadStatus)}
                      className={`text-xs rounded-full px-2.5 py-1 font-medium border-0 cursor-pointer ${LEAD_STATUS_COLORS[l.status as CrmLeadStatus] ?? "bg-gray-100 text-gray-600"} disabled:opacity-70`}>
                      {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                      {l.status === "converted" && <option value="converted">In Funnel ✓</option>}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {l.phone && (
                      <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline mr-3">
                        <MessageSquare className="w-3 h-3" /> Chat
                      </a>
                    )}
                    <a href={`/dashboard/sales-os/leads/${l.id}`}
                      className="text-xs text-brand-red hover:underline">Open →</a>
                  </td>
                </tr>
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inp = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>
      {children}
    </label>
  );
}
