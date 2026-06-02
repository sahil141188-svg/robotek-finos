"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logActivity, toggleActivityDone } from "@/app/actions/crm";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/types";
import type { ActivityWithNames } from "@/lib/crm/queries";
import { Plus, X, CheckCircle2, Circle } from "lucide-react";

type AccountLite = { id: string; name: string };
type SalesMember = { id: string; full_name: string };

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ActivitiesClient({
  activities, accounts, sales,
}: { activities: ActivityWithNames[]; accounts: AccountLite[]; sales: SalesMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openItems = activities.filter((a) => !a.done);
  const doneItems = activities.filter((a) => a.done);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await logActivity(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  function toggle(id: string, done: boolean) {
    start(async () => { await toggleActivityDone(id, done); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{openItems.length} open · {doneItems.length} done</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{open ? "Close" : "Log Activity"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Type">
            <select name="type" className={inputCls} defaultValue="call">
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Subject *"><input name="subject" required className={inputCls} /></Field>
          <Field label="Due / Follow-up"><input name="due_at" type="datetime-local" className={inputCls} /></Field>
          <Field label="Account">
            <select name="account_id" className={inputCls} defaultValue="">
              <option value="">— none —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select name="owner_id" className={inputCls} defaultValue="">
              <option value="">Me</option>
              {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <Field label="Notes"><input name="body" className={inputCls} /></Field>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Save Activity"}
            </button>
          </div>
        </form>
      )}

      <ActivityList title="Open" items={openItems} pending={pending} onToggle={toggle} empty="Nothing pending — nice." />
      {doneItems.length > 0 && (
        <ActivityList title="Completed" items={doneItems} pending={pending} onToggle={toggle} empty="" />
      )}
    </div>
  );
}

function ActivityList({ title, items, pending, onToggle, empty }: {
  title: string; items: ActivityWithNames[]; pending: boolean; onToggle: (id: string, done: boolean) => void; empty: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <h3 className="text-sm font-semibold text-brand-black mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-brand-gray-mid">{empty}</p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((a) => (
            <div key={a.id} className="py-2.5 flex items-start gap-3 text-sm">
              <button onClick={() => onToggle(a.id, !a.done)} disabled={pending} className="mt-0.5">
                {a.done ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Circle className="w-4 h-4 text-brand-gray-mid" />}
              </button>
              <div className="flex-1">
                <div className={`font-medium ${a.done ? "line-through text-brand-gray-mid" : "text-brand-black"}`}>
                  <span className="text-[10px] uppercase tracking-wide bg-brand-gray-light rounded px-1.5 py-0.5 mr-2 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[a.type]}</span>
                  {a.subject}
                </div>
                {(a.body || a.account_name) && (
                  <div className="text-xs text-brand-gray-mid mt-0.5">
                    {a.account_name ? <span>{a.account_name}</span> : null}
                    {a.account_name && a.body ? " · " : ""}
                    {a.body}
                  </div>
                )}
              </div>
              <div className="text-xs text-brand-gray-mid text-right whitespace-nowrap">
                {fmtDate(a.due_at)}
                {a.owner_name && <div>{a.owner_name}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
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
