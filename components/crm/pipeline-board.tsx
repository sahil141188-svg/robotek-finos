"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createDeal, moveDealStage } from "@/app/actions/crm";
import { DEAL_STAGES, DEAL_STAGE_LABELS, DEPARTMENT_SHORT, CRM_SOURCES } from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { CrmDealStage } from "@/types/database";
import type { DealWithNames } from "@/lib/crm/queries";
import { Plus, X, Building2 } from "lucide-react";

type AccountLite = { id: string; name: string };
type SalesMember = { id: string; full_name: string };

const ALL_STAGES: CrmDealStage[] = DEAL_STAGES.map((s) => s.key);

export function PipelineBoard({
  deals, accounts, sales,
}: { deals: DealWithNames[]; accounts: AccountLite[]; sales: SalesMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createDeal(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  function move(id: string, stage: CrmDealStage) {
    let reason: string | undefined;
    if (stage === "lost") {
      reason = window.prompt("Reason for marking this deal lost?") ?? undefined;
    }
    start(async () => {
      await moveDealStage(id, stage, reason);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{deals.length} deals</p>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {open ? "Close" : "New Deal"}
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
              {ALL_STAGES.filter((s) => s !== "won" && s !== "lost").map((s) => (
                <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>
              ))}
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

      {/* Kanban columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {DEAL_STAGES.map((stage) => {
          const colDeals = deals.filter((d) => d.stage === stage.key);
          const total = colDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
          return (
            <div key={stage.key} className={`rounded-xl border border-t-4 ${stage.accent} border-border bg-brand-gray-light/30 flex flex-col min-h-[120px]`}>
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-black">{stage.label}</span>
                  <span className="text-[10px] text-brand-gray-mid">{colDeals.length}</span>
                </div>
                <div className="text-[11px] text-brand-gray-mid mt-0.5">{formatIndian(total, 0)}</div>
              </div>
              <div className="p-2 space-y-2 flex-1">
                {colDeals.map((d) => (
                  <div key={d.id} className="rounded-lg border border-border bg-white p-2.5 shadow-sm">
                    <div className="text-xs font-medium text-brand-black leading-snug">{d.title}</div>
                    {d.account_name && (
                      <Link href={d.account_id ? `/dashboard/sales-os/accounts/${d.account_id}` : "#"} className="mt-1 flex items-center gap-1 text-[11px] text-brand-gray-mid hover:text-brand-red">
                        <Building2 className="w-3 h-3" />{d.account_name}
                      </Link>
                    )}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-black tabular-nums">{formatIndian(Number(d.value) || 0, 0)}</span>
                      <span className="text-[9px] font-bold text-brand-gray-mid bg-brand-gray-light rounded px-1 py-0.5">{DEPARTMENT_SHORT[d.department]}</span>
                    </div>
                    {d.owner_name && <div className="text-[10px] text-brand-gray-mid mt-1">{d.owner_name}</div>}
                    <select
                      value={d.stage}
                      disabled={pending}
                      onChange={(e) => move(d.id, e.target.value as CrmDealStage)}
                      className="mt-2 w-full text-[11px] rounded border border-border px-1.5 py-1 bg-white disabled:opacity-60"
                    >
                      {ALL_STAGES.map((s) => <option key={s} value={s}>{DEAL_STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>
                ))}
                {colDeals.length === 0 && <div className="text-[11px] text-brand-gray-mid text-center py-4">—</div>}
              </div>
            </div>
          );
        })}
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
