"use client";

/**
 * Editable per-customer focus targets — change an item's monthly target qty,
 * remove an item, or add a new item. Writes via server actions.
 */
import { useState, useTransition } from "react";
import { Star, Trash2, Plus, Check } from "lucide-react";
import { updateCustomerItemTarget, addCustomerItemTarget, removeCustomerItemTarget } from "@/app/actions/sales";
import { formatQty } from "@/lib/format";

type Row = { productId: string; productName: string; monthlyTarget: number; monthsActive: number; lastQty: number | null; highValue: boolean };
type Product = { id: string; name: string };

export function CustomerTargetsEditor({ customerId, initialFocus, products, factor, monthLabel }: {
  customerId: string; initialFocus: Row[]; products: Product[]; factor: number; monthLabel: string;
}) {
  const [rows, setRows] = useState<Row[]>(initialFocus);
  const [pending, start] = useTransition();
  const [savedId, setSavedId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState("");
  const [err, setErr] = useState("");

  function setQty(id: string, v: number) {
    setRows((rs) => rs.map((r) => (r.productId === id ? { ...r, monthlyTarget: v } : r)));
  }
  function commit(row: Row) {
    start(async () => {
      const res = await updateCustomerItemTarget(customerId, row.productId, row.monthlyTarget);
      if (res.ok) { setSavedId(row.productId); setTimeout(() => setSavedId(null), 1500); }
      else setErr(res.error || "Save failed");
    });
  }
  function remove(id: string) {
    start(async () => {
      const res = await removeCustomerItemTarget(customerId, id);
      if (res.ok) setRows((rs) => rs.filter((r) => r.productId !== id));
      else setErr(res.error || "Remove failed");
    });
  }
  function add() {
    setErr("");
    const p = products.find((x) => x.name.toLowerCase() === newName.trim().toLowerCase());
    if (!p) { setErr("Pick an item from the list"); return; }
    if (rows.some((r) => r.productId === p.id)) { setErr("Already in the list"); return; }
    const qty = Math.max(0, Math.round(Number(newQty) || 0));
    start(async () => {
      const res = await addCustomerItemTarget(customerId, p.id, qty);
      if (res.ok) {
        setRows((rs) => [...rs, { productId: p.id, productName: p.name, monthlyTarget: qty, monthsActive: 0, lastQty: null, highValue: false }]);
        setNewName(""); setNewQty("");
      } else setErr(res.error || "Add failed");
    });
  }

  return (
    <div className="overflow-x-auto">
      {err && <p className="px-5 py-2 text-xs text-red-600">{err}</p>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-brand-gray-mid bg-brand-gray-light/50">
            <th className="text-left font-medium px-5 py-2.5">Item</th>
            <th className="text-right font-medium px-3 py-2.5">Monthly target</th>
            <th className="text-right font-medium px-3 py-2.5">{monthLabel} goal</th>
            <th className="text-right font-medium px-3 py-2.5">Regularity</th>
            <th className="text-right font-medium px-3 py-2.5">Last qty</th>
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.productId} className="border-t border-border hover:bg-brand-gray-light/40 transition-colors">
              <td className="px-5 py-2.5 font-medium text-brand-black">
                {r.highValue && <Star className="inline w-3.5 h-3.5 mr-1.5 text-brand-yellow fill-brand-yellow align-text-bottom" />}
                {r.productName}
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className="inline-flex items-center gap-1.5 justify-end">
                  <input
                    type="number" value={r.monthlyTarget}
                    onChange={(e) => setQty(r.productId, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                    onBlur={() => commit(r)}
                    onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    className="w-24 h-8 rounded-lg border border-border px-2 text-right focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                  />
                  {savedId === r.productId && <Check className="w-4 h-4 text-green-600" />}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right font-semibold text-brand-black">{formatQty(Math.round(r.monthlyTarget * factor))}</td>
              <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.monthsActive ? `${r.monthsActive}/8 mo` : "manual"}</td>
              <td className="px-3 py-2.5 text-right text-brand-gray-mid">{r.lastQty != null ? formatQty(r.lastQty) : "—"}</td>
              <td className="px-3 py-2.5 text-right">
                <button onClick={() => remove(r.productId)} disabled={pending} className="text-brand-gray-mid hover:text-red-600 disabled:opacity-50" aria-label="Remove">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} className="px-5 py-6 text-center text-xs text-brand-gray-mid">No targets yet — add one below.</td></tr>}
        </tbody>
      </table>

      {/* Add row */}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-border bg-brand-gray-light/30">
        <input
          list="sales-products" value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="Add item…" className="h-8 w-56 rounded-lg border border-border px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
        <datalist id="sales-products">{products.map((p) => <option key={p.id} value={p.name} />)}</datalist>
        <input
          type="number" value={newQty} onChange={(e) => setNewQty(e.target.value)} placeholder="Qty/mo"
          className="h-8 w-24 rounded-lg border border-border px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
        />
        <button onClick={add} disabled={pending} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-brand-red text-white hover:bg-brand-maroon disabled:opacity-50 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Add item
        </button>
      </div>
    </div>
  );
}
