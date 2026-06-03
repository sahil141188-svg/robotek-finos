"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProduct, toggleProduct } from "@/app/actions/crm-quotes";
import { formatIndian } from "@/lib/format";
import type { Database } from "@/types/database";
import { Plus, X } from "lucide-react";

type Product = Database["public"]["Tables"]["crm_products"]["Row"];

export function ProductsClient({ products }: { products: Product[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createProduct(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null); form.reset(); setOpen(false); router.refresh();
    });
  }
  function toggle(id: string, active: boolean) {
    start(async () => { await toggleProduct(id, active); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{products.length} products</p>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{open ? "Close" : "New Product"}
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Name *"><input name="name" required className={inputCls} /></Field>
          <Field label="SKU"><input name="sku" className={inputCls} /></Field>
          <Field label="Category"><input name="category" className={inputCls} placeholder="Chargers, Cables…" /></Field>
          <Field label="HSN code"><input name="hsn" className={inputCls} /></Field>
          <Field label="Unit"><input name="unit" defaultValue="pcs" className={inputCls} /></Field>
          <Field label="Unit price (₹)"><input name="unit_price" type="number" step="0.01" min="0" className={inputCls} /></Field>
          <Field label="GST %"><input name="gst_rate" type="number" step="0.01" min="0" defaultValue="18" className={inputCls} /></Field>
          <div className="sm:col-span-3 flex justify-end">
            <button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">{pending ? "Saving…" : "Save Product"}</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">HSN</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-center">GST</th>
              <th className="px-4 py-3 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-brand-gray-mid">No products yet.</td></tr>}
            {products.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-brand-gray-light/30">
                <td className="px-4 py-3">
                  <div className="font-medium text-brand-black">{p.name}</div>
                  {p.sku && <div className="text-xs text-brand-gray-mid">{p.sku} · {p.unit}</div>}
                </td>
                <td className="px-4 py-3 text-brand-gray-mid">{p.category ?? "—"}</td>
                <td className="px-4 py-3 text-brand-gray-mid">{p.hsn ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatIndian(Number(p.unit_price) || 0, 0)}</td>
                <td className="px-4 py-3 text-center text-brand-gray-mid">{Number(p.gst_rate)}%</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggle(p.id, !p.is_active)} disabled={pending}
                    className={`text-xs rounded-full px-2 py-0.5 font-medium ${p.is_active ? "bg-emerald-100 text-emerald-700" : "bg-brand-gray-light text-brand-gray-mid"}`}>
                    {p.is_active ? "Active" : "Inactive"}
                  </button>
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
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
