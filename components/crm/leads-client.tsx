"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLead, updateLeadStatus, convertLead } from "@/app/actions/crm";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, CRM_SOURCES } from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { CrmLeadStatus } from "@/types/database";
import type { LeadWithNames } from "@/lib/crm/queries";
import { Plus, ArrowRight, Phone, Mail, X } from "lucide-react";

type SalesMember = { id: string; full_name: string };

const STATUS_OPTIONS: CrmLeadStatus[] = ["new", "contacted", "qualified", "unqualified", "converted"];

export function LeadsClient({ leads, sales }: { leads: LeadWithNames[]; sales: SalesMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{leads.length} leads</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {open ? "Close" : "New Lead"}
        </button>
      </div>

      {err && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
      )}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name *"><input name="name" required className={inputCls} placeholder="Person or business" /></Field>
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
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-brand-gray-mid">No leads yet. Click “New Lead” to add one.</td></tr>
            )}
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-brand-black">{l.name}</div>
                  {l.company && <div className="text-xs text-brand-gray-mid">{l.company}</div>}
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
                <td className="px-4 py-3 text-right">
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
