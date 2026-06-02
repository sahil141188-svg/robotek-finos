"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createAccount } from "@/app/actions/crm";
import {
  ACCOUNT_TYPE_LABELS, ACCOUNT_STATUS_LABELS, DEPARTMENT_SHORT,
} from "@/lib/crm/types";
import type { AccountWithNames } from "@/lib/crm/queries";
import { Plus, X, ChevronRight } from "lucide-react";

type SalesMember = { id: string; full_name: string };
type DeptFilter = "all" | "crr" | "nbd";

export function AccountsClient({ accounts, sales }: { accounts: AccountWithNames[]; sales: SalesMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<DeptFilter>("all");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const shown = accounts.filter((a) => filter === "all" || a.department === filter);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createAccount(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5 text-sm">
          {(["all", "nbd", "crr"] as DeptFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"}`}
            >
              {f === "all" ? "All" : DEPARTMENT_SHORT[f]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors"
        >
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {open ? "Close" : "New Account"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name *"><input name="name" required className={inputCls} /></Field>
          <Field label="Type">
            <select name="type" className={inputCls} defaultValue="dealer">
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <select name="department" className={inputCls} defaultValue="nbd">
              <option value="nbd">NBD (New Business)</option>
              <option value="crr">CRR (Reorder)</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" className={inputCls} defaultValue="prospect">
              {Object.entries(ACCOUNT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Field>
          <Field label="Owner">
            <select name="owner_id" className={inputCls} defaultValue="">
              <option value="">Unassigned</option>
              {sales.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
          </Field>
          <Field label="GSTIN"><input name="gstin" className={inputCls} /></Field>
          <Field label="Phone"><input name="phone" className={inputCls} /></Field>
          <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
          <Field label="City"><input name="city" className={inputCls} /></Field>
          <Field label="State"><input name="state" className={inputCls} /></Field>
          <div className="sm:col-span-2">
            <Field label="Address"><input name="address" className={inputCls} /></Field>
          </div>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
              {pending ? "Saving…" : "Save Account"}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Dept</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium text-center">Open Deals</th>
              <th className="px-4 py-3 font-medium text-right"></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-brand-gray-mid">No accounts in this view.</td></tr>
            )}
            {shown.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/sales-os/accounts/${a.id}`} className="font-medium text-brand-black hover:text-brand-red">{a.name}</Link>
                  <div className="text-xs text-brand-gray-mid">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</div>
                </td>
                <td className="px-4 py-3 text-brand-gray-mid">{ACCOUNT_TYPE_LABELS[a.type]}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-bold text-brand-gray-mid bg-brand-gray-light rounded px-1.5 py-0.5">{DEPARTMENT_SHORT[a.department]}</span>
                </td>
                <td className="px-4 py-3 text-brand-gray-mid">{ACCOUNT_STATUS_LABELS[a.status]}</td>
                <td className="px-4 py-3 text-brand-gray-mid">{a.owner_name ?? "—"}</td>
                <td className="px-4 py-3 text-center tabular-nums">{a.open_deals}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/sales-os/accounts/${a.id}`} className="inline-flex items-center text-brand-red hover:underline text-xs">
                    Open <ChevronRight className="w-3 h-3" />
                  </Link>
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
