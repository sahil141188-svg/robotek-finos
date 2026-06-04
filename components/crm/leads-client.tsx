"use client";

import { useState, useTransition, Fragment } from "react";
import { useRouter } from "next/navigation";
import { createLead, updateLeadStatus, convertLead, scheduleFollowup, startDrip, stopDrip, setLeadTags, distributeLeads } from "@/app/actions/crm";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, CRM_SOURCES } from "@/lib/crm/types";
import { LEAD_TYPE_LABELS, DRIP_STATUS_LABELS, DRIP_STATUS_COLORS } from "@/lib/crm/drip";
import { scoreLead, BAND_LABELS, BAND_COLORS } from "@/lib/crm/scoring";
import { ArrangeMeeting, type MeetingTarget } from "@/components/crm/arrange-meeting";
import { formatIndian } from "@/lib/format";
import type { CrmLeadStatus } from "@/types/database";
import type { LeadWithNames } from "@/lib/crm/queries";
import { Plus, ArrowRight, Phone, Mail, X, Clock, CalendarPlus } from "lucide-react";

type SalesMember = { id: string; full_name: string };

const STATUS_OPTIONS: CrmLeadStatus[] = ["new", "contacted", "qualified", "unqualified", "converted"];

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

export function LeadsClient({
  leads, sales, nextFollowups, meetingTargets,
}: { leads: LeadWithNames[]; sales: SalesMember[]; nextFollowups: Record<string, string>; meetingTargets: MeetingTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // inline follow-up scheduling, keyed by lead id
  const [fuLead, setFuLead] = useState<string | null>(null);
  const [fuDate, setFuDate] = useState("");
  const [fuSubject, setFuSubject] = useState("");
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  function saveFollowup(leadId: string) {
    start(async () => {
      const r = await scheduleFollowup({ leadId, dueAt: fuDate, subject: fuSubject || "Follow-up lead" });
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      setFuLead(null);
      setFuDate("");
      setFuSubject("");
      router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createLead(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  function changeStatus(id: string, status: CrmLeadStatus) {
    start(async () => {
      await updateLeadStatus(id, status);
      router.refresh();
    });
  }

  function handleConvert(id: string) {
    start(async () => {
      const r = await convertLead(id);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      router.refresh();
    });
  }

  function handleDrip(id: string, action: "start" | "stop") {
    start(async () => {
      const r = action === "start" ? await startDrip(id) : await stopDrip(id);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      router.refresh();
    });
  }

  function saveTags(id: string, tags: string[]) {
    start(async () => { await setLeadTags(id, tags); router.refresh(); });
  }
  function addTag(lead: LeadWithNames) {
    const t = window.prompt("Add a tag (e.g. South India, High value)");
    if (t && t.trim()) saveTags(lead.id, [...(lead.tags ?? []), t.trim()]);
  }
  function removeTag(lead: LeadWithNames, tag: string) {
    saveTags(lead.id, (lead.tags ?? []).filter((x) => x !== tag));
  }

  const allTags = Array.from(new Set(leads.flatMap((l) => l.tags ?? []))).sort();
  const shown = tagFilter ? leads.filter((l) => (l.tags ?? []).includes(tagFilter)) : leads;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-brand-gray-mid">{tagFilter ? `${shown.length} of ${leads.length}` : leads.length} leads</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => start(async () => { const r = await distributeLeads(); setErr(r.error ?? (r.assigned ? null : "Nothing to assign")); if (!r.error) { setErr(null); window.alert(`Assigned ${r.assigned} leads to NBD Sales Coordinators.`); } router.refresh(); })}
            disabled={pending}
            className="text-xs text-brand-gray-mid hover:text-brand-red underline disabled:opacity-60"
          >
            Distribute to SCs
          </button>
          <a href="/dashboard/sales-os/leads/import" className="text-xs text-brand-gray-mid hover:text-brand-red underline">
            Import from sheet
          </a>
          <a href="/intake" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-gray-mid hover:text-brand-red underline">
            Public intake form ↗
          </a>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
          >
            {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {open ? "Close" : "New Lead"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-brand-gray-mid">Filter:</span>
          <button onClick={() => setTagFilter(null)} className={`text-xs rounded-full px-2.5 py-1 ${!tagFilter ? "bg-brand-red text-white" : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>All</button>
          {allTags.map((t) => (
            <button key={t} onClick={() => setTagFilter(t === tagFilter ? null : t)} className={`text-xs rounded-full px-2.5 py-1 ${tagFilter === t ? "bg-brand-red text-white" : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>{t}</button>
          ))}
        </div>
      )}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name *"><input name="name" required className={inputCls} placeholder="Person or business" /></Field>
          <Field label="Lead type">
            <select name="lead_type" className={inputCls} defaultValue="channel_partner">
              <option value="channel_partner">Channel Partner (SS / distributor / dealer)</option>
              <option value="corporate">Corporate (brand / OEM / bulk buyer)</option>
            </select>
          </Field>
          <Field label="Company"><input name="company" className={inputCls} /></Field>
          <Field label="Source">
            <select name="source" className={inputCls} defaultValue="">
              <option value="">—</option>
              {CRM_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Phone"><input name="phone" className={inputCls} /></Field>
          <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
          <Field label="Est. Value (₹)"><input name="est_value" type="number" min="0" className={inputCls} /></Field>
          <Field label="City"><input name="city" className={inputCls} /></Field>
          <Field label="State"><input name="state" className={inputCls} /></Field>
          <Field label="Assign To">
            <select name="assigned_to" className={inputCls} defaultValue="">
              <option value="">Unassigned</option>
              {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3">
            <Field label="Notes"><textarea name="notes" rows={2} className={inputCls} /></Field>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Save Lead"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-4 py-3 font-medium">Lead</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium text-right">Est. Value</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Drip</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-brand-gray-mid">{tagFilter ? "No leads with this tag." : "No leads yet. Click “New Lead” to add one."}</td></tr>
            )}
            {shown.map((l) => (
              <Fragment key={l.id}>
              <tr className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-brand-black flex items-center gap-2">
                    {l.name}
                    {(() => { const { score, band } = scoreLead(l); return (
                      <span className={`text-[10px] rounded-full px-1.5 py-0.5 font-medium ${BAND_COLORS[band]}`} title={`Lead score ${score}/100`}>
                        {BAND_LABELS[band]} {score}
                      </span>
                    ); })()}
                  </div>
                  <div className="text-[10px] text-brand-gray-mid">{LEAD_TYPE_LABELS[l.lead_type]}{l.company ? ` · ${l.company}` : ""}</div>
                  {nextFollowups[l.id] && (
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-amber-700">
                      <Clock className="w-3 h-3" />Next: {fmtShort(nextFollowups[l.id])}
                    </div>
                  )}
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {(l.tags ?? []).map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5 text-[10px] bg-purple-100 text-purple-700 rounded-full px-1.5 py-0.5">
                        {t}<button onClick={() => removeTag(l, t)} className="hover:text-purple-900">×</button>
                      </span>
                    ))}
                    <button onClick={() => addTag(l)} disabled={pending} className="text-[10px] text-brand-gray-mid hover:text-brand-red border border-dashed border-border rounded-full px-1.5 py-0.5">+ tag</button>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-brand-gray-mid">
                  {l.phone && <div className="flex items-center gap-1"><Phone className="w-3 h-3" />{l.phone}</div>}
                  {l.email && <div className="flex items-center gap-1"><Mail className="w-3 h-3" />{l.email}</div>}
                  {!l.phone && !l.email && "—"}
                </td>
                <td className="px-4 py-3 text-brand-gray-mid">{l.source ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{l.est_value ? formatIndian(l.est_value, 0) : "—"}</td>
                <td className="px-4 py-3 text-brand-gray-mid">{l.assigned_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <select
                    value={l.status}
                    disabled={pending || l.status === "converted"}
                    onChange={(e) => changeStatus(l.id, e.target.value as CrmLeadStatus)}
                    className={`text-xs rounded-full px-2.5 py-1 font-medium border-0 ${LEAD_STATUS_COLORS[l.status]} disabled:opacity-70`}
                  >
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <span className={`text-[11px] rounded-full px-2 py-0.5 font-medium ${DRIP_STATUS_COLORS[l.drip_status]}`}>
                      {DRIP_STATUS_LABELS[l.drip_status]}
                    </span>
                    {l.drip_status === "active" ? (
                      <button onClick={() => handleDrip(l.id, "stop")} disabled={pending} className="text-[11px] text-amber-700 hover:underline disabled:opacity-60">Stop</button>
                    ) : (
                      <button onClick={() => handleDrip(l.id, "start")} disabled={pending} className="text-[11px] text-emerald-700 hover:underline disabled:opacity-60">
                        {l.drip_status === "none" ? "Start drip" : "Restart"}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <span className="mr-3 inline-block"><ArrangeMeeting leadId={l.id} leadName={l.name} targets={meetingTargets} defaultNotes={l.notes} compact /></span>
                  <button
                    onClick={() => { setFuLead(fuLead === l.id ? null : l.id); setFuDate(""); setFuSubject(""); }}
                    disabled={pending}
                    className="inline-flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-black disabled:opacity-60 mr-3"
                  >
                    <CalendarPlus className="w-3 h-3" />{fuLead === l.id ? "Cancel" : "Follow-up"}
                  </button>
                  {l.status === "converted" ? (
                    <span className="text-xs text-purple-600">Converted</span>
                  ) : (
                    <button
                      onClick={() => handleConvert(l.id)}
                      disabled={pending}
                      className="inline-flex items-center gap-1 text-xs text-brand-red hover:underline disabled:opacity-60"
                    >
                      Convert <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </td>
              </tr>
              {fuLead === l.id && (
                <tr className="bg-brand-gray-light/40 border-b border-border">
                  <td colSpan={8} className="px-4 py-3">
                    <div className="flex items-end gap-2 flex-wrap">
                      <label className="block">
                        <span className="text-[11px] font-medium text-brand-gray-mid mb-1 block">Follow-up date</span>
                        <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className={inputCls} />
                      </label>
                      <label className="block flex-1 min-w-[200px]">
                        <span className="text-[11px] font-medium text-brand-gray-mid mb-1 block">What to do</span>
                        <input value={fuSubject} onChange={(e) => setFuSubject(e.target.value)} placeholder="e.g. Call to qualify / arrange meeting" className={inputCls} />
                      </label>
                      <button
                        onClick={() => saveFollowup(l.id)}
                        disabled={pending || !fuDate}
                        className="px-3 py-2 bg-brand-red text-white rounded-lg text-xs font-medium hover:bg-brand-maroon disabled:opacity-50 transition-colors"
                      >
                        {pending ? "Saving…" : "Schedule"}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>
      {children}
    </label>
  );
}
