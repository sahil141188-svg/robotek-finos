"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext, useDraggable, useDroppable, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { createDeal, moveDealStage, scheduleFollowup } from "@/app/actions/crm";
import { DEAL_STAGES, DEAL_STAGE_LABELS, DEPARTMENT_SHORT, CRM_SOURCES } from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { CrmDealStage } from "@/types/database";
import type { DealWithNames } from "@/lib/crm/queries";
import { Plus, X, Building2, Clock, CalendarPlus, GripVertical } from "lucide-react";

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

type AccountLite = { id: string; name: string };
type SalesMember = { id: string; full_name: string };

const ALL_STAGES: CrmDealStage[] = DEAL_STAGES.map((s) => s.key);
const PRIORITY_COLORS: Record<string, string> = {
  HOT: "bg-red-100 text-red-700", MEDIUM: "bg-amber-100 text-amber-700", COLD: "bg-blue-100 text-blue-700",
};

export function PipelineBoard({
  deals, accounts, sales, nextFollowups,
}: {
  deals: DealWithNames[]; accounts: AccountLite[]; sales: SalesMember[];
  nextFollowups: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [fuDeal, setFuDeal] = useState<string | null>(null);
  const [fuDate, setFuDate] = useState("");
  const [fuSubject, setFuSubject] = useState("");

  // Require a small drag distance so clicks on the card don't trigger a drag.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function saveFollowup(dealId: string) {
    start(async () => {
      const r = await scheduleFollowup({ dealId, dueAt: fuDate, subject: fuSubject || "Follow-up" });
      if (r.error) { setErr(r.error); return; }
      setErr(null); setFuDeal(null); setFuDate(""); setFuSubject(""); router.refresh();
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createDeal(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null); form.reset(); setOpen(false); router.refresh();
    });
  }

  function move(id: string, stage: CrmDealStage) {
    let reason: string | undefined;
    if (stage === "lost") reason = window.prompt("Reason for marking this deal lost?") ?? undefined;
    start(async () => { await moveDealStage(id, stage, reason); router.refresh(); });
  }

  function onDragEnd(e: DragEndEvent) {
    const dealId = String(e.active.id);
    const overStage = e.over?.id ? (String(e.over.id) as CrmDealStage) : null;
    if (!overStage) return;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === overStage) return;
    move(dealId, overStage);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{deals.length} deals · drag the ⠿ handle to move stages</p>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{open ? "Close" : "New Deal"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Title *"><input name="title" required className={inputCls} placeholder="e.g. Ramesh Traders — bulk cable order" /></Field>
          <Field label="Account">
            <select name="account_id" className={inputCls} defaultValue="">
              <option value="">— none —</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select name="department" className={inputCls} defaultValue="nbd">
              <option value="nbd">NBD (New Business)</option>
              <option value="crr">CRR (Reorder)</option>
            </select>
          </Field>
          <Field label="Stage">
            <select name="stage" className={inputCls} defaultValue="new">
              {ALL_STAGES.filter((s) => s !== "won" && s !== "lost").map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
            </select>
          </Field>
          <Field label="Value (₹)"><input name="value" type="number" min="0" className={inputCls} /></Field>
          <Field label="Owner">
            <select name="owner_id" className={inputCls} defaultValue="">
              <option value="">Unassigned</option>
              {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <Field label="Expected Close"><input name="expected_close" type="date" className={inputCls} /></Field>
          <Field label="Source">
            <select name="source" className={inputCls} defaultValue="">
              <option value="">—</option>
              {CRM_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Save Deal"}
            </button>
          </div>
        </form>
      )}

      {/* Kanban with drag-and-drop */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {DEAL_STAGES.map((stage) => {
            const colDeals = deals.filter((d) => d.stage === stage.key);
            const total = colDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
            return (
              <Column key={stage.key} stageKey={stage.key} accent={stage.accent} label={stage.label} count={colDeals.length} total={total}>
                {colDeals.map((d) => (
                  <DealCard
                    key={d.id} deal={d} pending={pending} nextFollowup={nextFollowups[d.id]}
                    onMove={(s) => move(d.id, s)}
                    fuOpen={fuDeal === d.id}
                    onToggleFu={() => { setFuDeal(fuDeal === d.id ? null : d.id); setFuDate(""); setFuSubject(""); }}
                    fuDate={fuDate} setFuDate={setFuDate} fuSubject={fuSubject} setFuSubject={setFuSubject}
                    onSaveFu={() => saveFollowup(d.id)}
                  />
                ))}
                {colDeals.length === 0 && <div className="text-[11px] text-brand-gray-mid text-center py-4">—</div>}
              </Column>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ stageKey, accent, label, count, total, children }: {
  stageKey: string; accent: string; label: string; count: number; total: number; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  return (
    <div ref={setNodeRef} className={`rounded-xl border border-t-4 ${accent} border-border flex flex-col min-h-[120px] transition-colors ${isOver ? "bg-brand-red/5 ring-1 ring-brand-red/30" : "bg-brand-gray-light/30"}`}>
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-brand-black">{label}</span>
          <span className="text-[10px] text-brand-gray-mid">{count}</span>
        </div>
        <div className="text-[11px] text-brand-gray-mid mt-0.5">{formatIndian(total, 0)}</div>
      </div>
      <div className="p-2 space-y-2 flex-1">{children}</div>
    </div>
  );
}

function DealCard({
  deal: d, pending, nextFollowup, onMove, fuOpen, onToggleFu, fuDate, setFuDate, fuSubject, setFuSubject, onSaveFu,
}: {
  deal: DealWithNames; pending: boolean; nextFollowup?: string;
  onMove: (s: CrmDealStage) => void;
  fuOpen: boolean; onToggleFu: () => void;
  fuDate: string; setFuDate: (v: string) => void; fuSubject: string; setFuSubject: (v: string) => void;
  onSaveFu: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: d.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;
  const priority = (d as { priority?: string | null }).priority;

  return (
    <div ref={setNodeRef} style={style} className={`rounded-lg border border-border bg-white p-2.5 shadow-sm ${isDragging ? "opacity-60 shadow-lg" : ""}`}>
      <div className="flex items-start justify-between gap-1">
        <Link href={`/dashboard/sales-os/deals/${d.id}`} className="block text-xs font-medium text-brand-black leading-snug hover:text-brand-red">{d.title}</Link>
        <button {...attributes} {...listeners} className="shrink-0 cursor-grab active:cursor-grabbing text-brand-gray-mid hover:text-brand-black touch-none" title="Drag to move stage">
          <GripVertical className="w-3.5 h-3.5" />
        </button>
      </div>
      {d.account_name && (
        <Link href={d.account_id ? `/dashboard/sales-os/accounts/${d.account_id}` : "#"} className="mt-1 flex items-center gap-1 text-[11px] text-brand-gray-mid hover:text-brand-red">
          <Building2 className="w-3 h-3" />{d.account_name}
        </Link>
      )}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-brand-black tabular-nums">{formatIndian(Number(d.value) || 0, 0)}</span>
        <div className="flex items-center gap-1">
          {priority && <span className={`text-[9px] font-bold rounded px-1 py-0.5 ${PRIORITY_COLORS[priority] ?? "bg-brand-gray-light text-brand-gray-mid"}`}>{priority}</span>}
          <span className="text-[9px] font-bold text-brand-gray-mid bg-brand-gray-light rounded px-1 py-0.5">{DEPARTMENT_SHORT[d.department]}</span>
        </div>
      </div>
      {d.owner_name && <div className="text-[10px] text-brand-gray-mid mt-1">{d.owner_name}</div>}
      <select value={d.stage} disabled={pending} onChange={(e) => onMove(e.target.value as CrmDealStage)}
        className="mt-2 w-full text-[11px] rounded border border-border px-1.5 py-1 bg-white disabled:opacity-60">
        {ALL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
      </select>

      <div className="mt-1.5 flex items-center justify-between">
        {nextFollowup ? (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700"><Clock className="w-3 h-3" />{fmtShort(nextFollowup)}</span>
        ) : (
          <span className="text-[10px] text-brand-gray-mid">No follow-up</span>
        )}
        <button onClick={onToggleFu} disabled={pending} className="inline-flex items-center gap-0.5 text-[10px] text-brand-red hover:underline disabled:opacity-60">
          <CalendarPlus className="w-3 h-3" />{fuOpen ? "Cancel" : "Follow-up"}
        </button>
      </div>

      {fuOpen && (
        <div className="mt-1.5 space-y-1.5 rounded bg-brand-gray-light/60 p-1.5">
          <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)} className="w-full text-[11px] rounded border border-border px-1.5 py-1 bg-white" />
          <input value={fuSubject} onChange={(e) => setFuSubject(e.target.value)} placeholder="e.g. Call buyer" className="w-full text-[11px] rounded border border-border px-1.5 py-1 bg-white" />
          <button onClick={onSaveFu} disabled={pending || !fuDate} className="w-full text-[11px] rounded bg-brand-red text-white py-1 font-medium hover:bg-brand-maroon disabled:opacity-50">
            {pending ? "Saving…" : "Schedule"}
          </button>
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
