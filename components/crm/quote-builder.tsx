"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQuote, type QuoteItemInput } from "@/app/actions/crm-quotes";
import { formatIndian } from "@/lib/format";
import type { Database } from "@/types/database";
import { Plus, Trash2 } from "lucide-react";

type Product = Database["public"]["Tables"]["crm_products"]["Row"];
type AccountLite = { id: string; name: string };
type Row = QuoteItemInput & { key: number };

let keyCounter = 1;
const newRow = (): Row => ({ key: keyCounter++, description: "", product_id: null, qty: 1, unit_price: 0, gst_rate: 18 });

export function QuoteBuilder({ products, accounts }: { products: Product[]; accounts: AccountLite[] }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("Prices inclusive of GST as shown. Delivery 7-10 days. Payment: 50% advance.");
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function update(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function applyProduct(key: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) { update(key, { product_id: null }); return; }
    update(key, { product_id: p.id, description: p.name, unit_price: Number(p.unit_price) || 0, gst_rate: Number(p.gst_rate) || 0 });
  }

  const lines = rows.map((r) => {
    const sub = (Number(r.qty) || 0) * (Number(r.unit_price) || 0);
    const tax = sub * ((Number(r.gst_rate) || 0) / 100);
    return { sub, tax, total: sub + tax };
  });
  const subtotal = lines.reduce((s, l) => s + l.sub, 0);
  const taxTotal = lines.reduce((s, l) => s + l.tax, 0);
  const grand = subtotal + taxTotal;

  function save() {
    start(async () => {
      const r = await createQuote({
        account_id: accountId || null,
        valid_until: validUntil || null,
        notes: notes || null,
        terms: terms || null,
        items: rows.map(({ description, product_id, qty, unit_price, gst_rate }) => ({ description, product_id, qty, unit_price, gst_rate })),
      });
      if (r.error) { setErr(r.error); return; }
      if (r.id) router.push(`/dashboard/sales-os/quotes/${r.id}`);
    });
  }

  return (
    <div className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      <div className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Account">
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            <option value="">— select account —</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Valid until"><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={inputCls} /></Field>
        <Field label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} placeholder="Optional note to customer" /></Field>
      </div>

      {/* Line items */}
      <div className="rounded-xl border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium text-right">Qty</th>
              <th className="px-3 py-2 font-medium text-right">Unit ₹</th>
              <th className="px-3 py-2 font-medium text-right">GST%</th>
              <th className="px-3 py-2 font-medium text-right">Line total</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <select value={r.product_id ?? ""} onChange={(e) => applyProduct(r.key, e.target.value)} className={`${inputCls} min-w-[120px]`}>
                    <option value="">Custom</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2"><input value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} className={`${inputCls} min-w-[160px]`} placeholder="Item description" /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="1" value={r.qty} onChange={(e) => update(r.key, { qty: Number(e.target.value) })} className={`${inputCls} w-20 text-right`} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={r.unit_price} onChange={(e) => update(r.key, { unit_price: Number(e.target.value) })} className={`${inputCls} w-24 text-right`} /></td>
                <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={r.gst_rate} onChange={(e) => update(r.key, { gst_rate: Number(e.target.value) })} className={`${inputCls} w-16 text-right`} /></td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatIndian(lines[i].total, 0)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((x) => x.key !== r.key) : rs)} className="text-brand-gray-mid hover:text-brand-red"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 border-t border-border">
          <button onClick={() => setRows((rs) => [...rs, newRow()])} className="inline-flex items-center gap-1.5 text-sm text-brand-red hover:underline"><Plus className="w-4 h-4" /> Add line</button>
        </div>
      </div>

      {/* Totals + terms */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-white p-4">
          <Field label="Terms"><textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={4} className={inputCls} /></Field>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 space-y-2 text-sm">
          <TotalRow label="Subtotal" value={formatIndian(subtotal, 0)} />
          <TotalRow label="GST" value={formatIndian(taxTotal, 0)} />
          <div className="border-t border-border pt-2"><TotalRow label="Total" value={formatIndian(grand, 0)} bold /></div>
          <button onClick={save} disabled={pending} className="w-full mt-2 px-4 py-2.5 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-brand-maroon disabled:opacity-60 transition-colors">
            {pending ? "Saving…" : "Create Quotation"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return <div className={`flex items-center justify-between ${bold ? "font-bold text-brand-black text-base" : "text-brand-gray-mid"}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}
const inputCls = "rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 w-full";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
