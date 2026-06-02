"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  logActivity, toggleActivityDone, rescheduleActivity, completeAndScheduleNext,
} from "@/app/actions/crm";
import { ACTIVITY_TYPE_LABELS, DEPARTMENT_SHORT } from "@/lib/crm/types";
import type { FollowupItem, FollowupBucket } from "@/lib/crm/queries";
import type { CrmDepartment } from "@/types/database";
import {
  Plus, X, CheckCircle2, Circle, Clock, CalendarPlus, RotateCcw,
  AlertTriangle, ArrowUpRight,
} from "lucide-react";

type AccountLite = { id: string; name: string };
type DealLite = { id: string; title: string };
type SalesMember = { id: string; full_name: string };
type DeptFilter = "all" | "nbd" | "crr";
type OwnerFilter = "all" | "me";

const BUCKET_META: Record<Exclude<FollowupBucket, "done">, { label: string; cls: string; icon: React.ReactNode }> = {
  overdue:  { label: "Overdue",  cls: "text-red-700 bg-red-50 border-red-200",      icon: <AlertTriangle className="w-4 h-4" /> },
  today:    { label: "Today",    cls: "text-amber-700 bg-amber-50 border-amber-200", icon: <Clock className="w-4 h-4" /> },
  upcoming: { label: "Upcoming", cls: "text-blue-700 bg-blue-50 border-blue-200",   icon: <CalendarPlus className="w-4 h-4" /> },
  someday:  { label: "No date",  cls: "text-brand-gray-mid bg-brand-gray-light border-border", icon: <Circle className="w-4 h-4" /> },
};
const ORDER: Exclude<FollowupBucket, "done">[] = ["overdue", "today", "upcoming", "someday"];

function fmt(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function FollowupsClient({
  items, accounts, deals, sales, currentUserId,
}: {
  items: FollowupItem[];
  accounts: AccountLite[];
  deals: DealLite[];
  sales: SalesMember[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [dept, setDept] = useState<DeptFilter>("nbd");
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id: string; mode: "snooze" | "next" } | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editSubj, setEditSubj] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = items.filter((i) => {
    if (dept !== "all" && i.department !== dept) return false;
    if (owner === "me" && i.owner_id !== currentUserId) return false;
    return true;
  });

  const byBucket = (b: FollowupBucket) => filtered.filter((i) => i.bucket === b);
  const overdueN = byBucket("overdue").length;
  const todayN = byBucket("today").length;
  const doneItems = byBucket("done");

  function refreshAfter(p: Promise<{ error: string | null }>) {
    start(async () => {
      const r = await p;
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      setEdit(null);
      setEditDate("");
      setEditSubj("");
      router.refresh();
    });
  }

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Segmented value={dept} onChange={(v) => setDept(v as DeptFilter)} options={[
            { v: "nbd", label: "NBD" }, { v: "crr", label: "CRR" }, { v: "all", label: "All" },
          ]} />
          <Segmented value={owner} onChange={(v) => setOwner(v as OwnerFilter)} options={[
            { v: "all", label: "Everyone" }, { v: "me", label: "Mine" },
          ]} />
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{open ? "Close" : "New Follow-up"}
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-3 text-sm">
        <span className={`px-2.5 py-1 rounded-lg font-medium ${overdueN ? "bg-red-50 text-red-700" : "bg-brand-gray-light text-brand-gray-mid"}`}>
          {overdueN} overdue
        </span>
        <span className={`px-2.5 py-1 rounded-lg font-medium ${todayN ? "bg-amber-50 text-amber-700" : "bg-brand-gray-light text-brand-gray-mid"}`}>
          {todayN} due today
        </span>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* New follow-up form */}
      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Type">
            <select name="type" className={inputCls} defaultValue="call">
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Subject *"><input name="subject" required className={inputCls} placeholder="e.g. Arrange meeting with buyer" /></Field>
          <Field label="Due / Follow-up date *"><input name="due_at" type="datetime-local" required className={inputCls} /></Field>
          <Field label="Link to deal">
            <select name="deal_id" className={inputCls} defaultValue="">
              <option value="">— none —</option>
              {deals.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
          <Field label="Link to account">
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
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Schedule Follow-up"}
            </button>
          </div>
        </form>
      )}

      {/* Buckets */}
      {ORDER.map((b) => {
        const list = byBucket(b);
        if (list.length === 0) return null;
        const meta = BUCKET_META[b];
        return (
          <div key={b} className="bg-white rounded-xl border border-border overflow-hidden">
            <div className={`flex items-center gap-2 px-4 py-2.5 border-b text-sm font-semibold ${meta.cls}`}>
              {meta.icon}{meta.label}<span className="opacity-70 font-normal">· {list.length}</span>
            </div>
            <div className="divide-y divide-border">
              {list.map((i) => (
                <Row
                  key={i.id} item={i} pending={pending}
                  edit={edit} editDate={editDate} editSubj={editSubj}
                  setEdit={setEdit} setEditDate={setEditDate} setEditSubj={setEditSubj}
                  onComplete={() => refreshAfter(toggleActivityDone(i.id, true))}
                  onSnooze={() => refreshAfter(rescheduleActivity(i.id, editDate))}
                  onNext={() => refreshAfter(completeAndScheduleNext(i.id, editDate, editSubj))}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.filter((i) => i.bucket !== "done").length === 0 && (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-sm text-brand-gray-mid">
          No open follow-ups in this view. 🎉
        </div>
      )}

      {/* Completed (collapsed-ish) */}
      {doneItems.length > 0 && (
        <details className="bg-white rounded-xl border border-border overflow-hidden">
          <summary className="px-4 py-2.5 text-sm font-semibold text-brand-gray-mid cursor-pointer">
            Completed · {doneItems.length}
          </summary>
          <div className="divide-y divide-border border-t border-border">
            {doneItems.map((i) => (
              <div key={i.id} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                <button onClick={() => refreshAfter(toggleActivityDone(i.id, false))} disabled={pending} className="mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </button>
                <div className="flex-1">
                  <div className="line-through text-brand-gray-mid">{i.subject}</div>
                  {i.context_label && <div className="text-xs text-brand-gray-mid">{i.context_label}</div>}
                </div>
                <div className="text-xs text-brand-gray-mid">{fmt(i.due_at)}</div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Row({
  item: i, pending, edit, editDate, editSubj, setEdit, setEditDate, setEditSubj,
  onComplete, onSnooze, onNext,
}: {
  item: FollowupItem; pending: boolean;
  edit: { id: string; mode: "snooze" | "next" } | null;
  editDate: string; editSubj: string;
  setEdit: (e: { id: string; mode: "snooze" | "next" } | null) => void;
  setEditDate: (v: string) => void; setEditSubj: (v: string) => void;
  onComplete: () => void; onSnooze: () => void; onNext: () => void;
}) {
  const editing = edit?.id === i.id;
  return (
    <div className="px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <button onClick={onComplete} disabled={pending} className="mt-0.5" title="Mark done">
          <Circle className="w-4 h-4 text-brand-gray-mid hover:text-emerald-600" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-brand-black flex items-center gap-2 flex-wrap">
            <span className="text-[10px] uppercase tracking-wide bg-brand-gray-light rounded px-1.5 py-0.5 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[i.type]}</span>
            {i.subject}
            {i.department && <span className="text-[9px] font-bold text-brand-gray-mid bg-brand-gray-light rounded px-1 py-0.5">{DEPARTMENT_SHORT[i.department as CrmDepartment]}</span>}
          </div>
          <div className="mt-0.5 text-xs text-brand-gray-mid flex items-center gap-2 flex-wrap">
            {i.context_label && (
              i.context_href
                ? <Link href={i.context_href} className="inline-flex items-center gap-0.5 hover:text-brand-red">{i.context_label}<ArrowUpRight className="w-3 h-3" /></Link>
                : <span>{i.context_label}</span>
            )}
            {i.owner_name && <span>· {i.owner_name}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-brand-gray-mid whitespace-nowrap">{fmt(i.due_at)}</span>
          <button
            onClick={() => { setEdit({ id: i.id, mode: "next" }); setEditDate(""); setEditSubj(""); }}
            disabled={pending}
            className="text-xs text-brand-red hover:underline inline-flex items-center gap-0.5"
            title="Complete and schedule the next follow-up"
          >
            <CalendarPlus className="w-3.5 h-3.5" /> Done + next
          </button>
          <button
            onClick={() => { setEdit({ id: i.id, mode: "snooze" }); setEditDate(""); }}
            disabled={pending}
            className="text-xs text-brand-gray-mid hover:text-brand-black inline-flex items-center gap-0.5"
            title="Reschedule"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Snooze
          </button>
        </div>
      </div>

      {/* Inline editor */}
      {editing && (
        <div className="mt-3 ml-7 flex items-end gap-2 flex-wrap rounded-lg bg-brand-gray-light/50 p-3">
          <label className="block">
            <span className="text-[11px] font-medium text-brand-gray-mid mb-1 block">
              {edit!.mode === "next" ? "Next follow-up date" : "New date"}
            </span>
            <input type="datetime-local" value={editDate} onChange={(e) => setEditDate(e.target.value)} className={inputCls} />
          </label>
          {edit!.mode === "next" && (
            <label className="block flex-1 min-w-[180px]">
              <span className="text-[11px] font-medium text-brand-gray-mid mb-1 block">Next subject (optional)</span>
              <input value={editSubj} onChange={(e) => setEditSubj(e.target.value)} placeholder={`Follow-up: ${i.subject}`} className={inputCls} />
            </label>
          )}
          <button
            onClick={edit!.mode === "next" ? onNext : onSnooze}
            disabled={pending || !editDate}
            className="px-3 py-2 bg-brand-red text-white rounded-lg text-xs font-medium hover:bg-brand-maroon disabled:opacity-50 transition-colors"
          >
            {pending ? "Saving…" : edit!.mode === "next" ? "Complete & schedule" : "Reschedule"}
          </button>
          <button onClick={() => setEdit(null)} className="px-3 py-2 text-xs text-brand-gray-mid hover:text-brand-black">Cancel</button>
        </div>
      )}
    </div>
  );
}

function Segmented({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { v: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${value === o.v ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"}`}
        >
          {o.label}
        </button>
      ))}
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
