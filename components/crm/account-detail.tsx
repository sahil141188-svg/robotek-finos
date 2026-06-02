"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addContact, logActivity, toggleActivityDone } from "@/app/actions/crm";
import {
  ACCOUNT_TYPE_LABELS, ACCOUNT_STATUS_LABELS, DEPARTMENT_LABELS,
  DEAL_STAGE_LABELS, ACTIVITY_TYPE_LABELS,
} from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { AccountDetail } from "@/lib/crm/queries";
import {
  Phone, Mail, MapPin, FileText, UserPlus, Plus, X,
  Star, CheckCircle2, Circle, Building2,
} from "lucide-react";

type SalesMember = { id: string; full_name: string };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function AccountDetailView({ detail, sales }: { detail: AccountDetail; sales: SalesMember[] }) {
  const router = useRouter();
  const { account, contacts, deals, activities } = detail;
  const [contactOpen, setContactOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(action: (fd: FormData) => Promise<{ error: string | null }>, close: () => void) {
    return (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      start(async () => {
        const r = await action(fd);
        if (r.error) { setErr(r.error); return; }
        setErr(null);
        form.reset();
        close();
        router.refresh();
      });
    };
  }

  function toggle(id: string, done: boolean) {
    start(async () => { await toggleActivityDone(id, done); router.refresh(); });
  }

  return (
    <div className="space-y-6">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* Account header */}
      <div className="rounded-xl border border-border bg-white p-5">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-brand-red" />
              <h2 className="text-lg font-bold text-brand-black">{account.name}</h2>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-brand-gray-mid">
              <span className="bg-brand-gray-light rounded px-2 py-0.5">{ACCOUNT_TYPE_LABELS[account.type]}</span>
              <span className="bg-brand-gray-light rounded px-2 py-0.5">{ACCOUNT_STATUS_LABELS[account.status]}</span>
              <span className="bg-brand-gray-light rounded px-2 py-0.5">{DEPARTMENT_LABELS[account.department]}</span>
              {account.owner_name && <span>Owner: {account.owner_name}</span>}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Info icon={<Phone className="w-3.5 h-3.5" />} value={account.phone} />
          <Info icon={<Mail className="w-3.5 h-3.5" />} value={account.email} />
          <Info icon={<MapPin className="w-3.5 h-3.5" />} value={[account.city, account.state].filter(Boolean).join(", ") || null} />
          <Info icon={<FileText className="w-3.5 h-3.5" />} value={account.gstin} />
        </div>
        {account.handed_off_at && (
          <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 rounded px-3 py-1.5 inline-block">
            Handed off to CRR on {fmtDate(account.handed_off_at)}
          </p>
        )}
      </div>

      {/* Contacts */}
      <Section
        title="Contacts"
        open={contactOpen}
        onToggle={() => setContactOpen((v) => !v)}
        addLabel="Add Contact"
        addIcon={<UserPlus className="w-4 h-4" />}
      >
        {contactOpen && (
          <form onSubmit={submit(addContact, () => setContactOpen(false))} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <input type="hidden" name="account_id" value={account.id} />
            <Field label="Name *"><input name="name" required className={inputCls} /></Field>
            <Field label="Designation"><input name="designation" className={inputCls} /></Field>
            <Field label="Phone"><input name="phone" className={inputCls} /></Field>
            <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
            <label className="flex items-center gap-2 text-xs text-brand-gray-mid self-end pb-2">
              <input type="checkbox" name="is_primary" /> Primary contact
            </label>
            <div className="flex items-end justify-end">
              <button type="submit" disabled={pending} className={btnCls}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
        {contacts.length === 0 ? (
          <p className="text-sm text-brand-gray-mid">No contacts yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {contacts.map((c) => (
              <div key={c.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-brand-black flex items-center gap-1.5">
                    {c.is_primary && <Star className="w-3.5 h-3.5 text-brand-yellow fill-brand-yellow" />}
                    {c.name}
                    {c.designation && <span className="text-xs text-brand-gray-mid font-normal">· {c.designation}</span>}
                  </div>
                </div>
                <div className="text-xs text-brand-gray-mid text-right">
                  {c.phone && <div>{c.phone}</div>}
                  {c.email && <div>{c.email}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Deals */}
      <div className="rounded-xl border border-border bg-white p-5">
        <h3 className="text-sm font-semibold text-brand-black mb-3">Deals</h3>
        {deals.length === 0 ? (
          <p className="text-sm text-brand-gray-mid">No deals for this account.</p>
        ) : (
          <div className="divide-y divide-border">
            {deals.map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium text-brand-black">{d.title}</div>
                  <div className="text-xs text-brand-gray-mid">{DEAL_STAGE_LABELS[d.stage]}{d.owner_name ? ` · ${d.owner_name}` : ""}</div>
                </div>
                <span className="font-semibold tabular-nums">{formatIndian(Number(d.value) || 0, 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activities */}
      <Section
        title="Activities & Follow-ups"
        open={activityOpen}
        onToggle={() => setActivityOpen((v) => !v)}
        addLabel="Log Activity"
        addIcon={<Plus className="w-4 h-4" />}
      >
        {activityOpen && (
          <form onSubmit={submit(logActivity, () => setActivityOpen(false))} className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <input type="hidden" name="account_id" value={account.id} />
            <Field label="Type">
              <select name="type" className={inputCls} defaultValue="call">
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Subject *"><input name="subject" required className={inputCls} /></Field>
            <Field label="Due / Follow-up"><input name="due_at" type="datetime-local" className={inputCls} /></Field>
            <Field label="Owner">
              <select name="owner_id" className={inputCls} defaultValue="">
                <option value="">Me</option>
                {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Notes"><input name="body" className={inputCls} /></Field>
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <button type="submit" disabled={pending} className={btnCls}>{pending ? "Saving…" : "Save"}</button>
            </div>
          </form>
        )}
        {activities.length === 0 ? (
          <p className="text-sm text-brand-gray-mid">No activities logged.</p>
        ) : (
          <div className="divide-y divide-border">
            {activities.map((a) => (
              <div key={a.id} className="py-2.5 flex items-start gap-3 text-sm">
                <button onClick={() => toggle(a.id, !a.done)} disabled={pending} className="mt-0.5">
                  {a.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-brand-gray-mid" />}
                </button>
                <div className="flex-1">
                  <div className={`font-medium ${a.done ? "line-through text-brand-gray-mid" : "text-brand-black"}`}>
                    <span className="text-[10px] uppercase tracking-wide bg-brand-gray-light rounded px-1.5 py-0.5 mr-2 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[a.type]}</span>
                    {a.subject}
                  </div>
                  {a.body && <div className="text-xs text-brand-gray-mid mt-0.5">{a.body}</div>}
                </div>
                <div className="text-xs text-brand-gray-mid text-right whitespace-nowrap">
                  {a.due_at ? fmtDate(a.due_at) : ""}
                  {a.owner_name && <div>{a.owner_name}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ title, open, onToggle, addLabel, addIcon, children }: {
  title: string; open: boolean; onToggle: () => void; addLabel: string; addIcon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
        <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-medium text-brand-red hover:underline">
          {open ? <X className="w-4 h-4" /> : addIcon}{open ? "Close" : addLabel}
        </button>
      </div>
      {children}
    </div>
  );
}

function Info({ icon, value }: { icon: React.ReactNode; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5 text-brand-gray-mid">
      {icon}<span className={value ? "text-brand-black" : ""}>{value ?? "—"}</span>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
const btnCls = "px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>
      {children}
    </label>
  );
}
