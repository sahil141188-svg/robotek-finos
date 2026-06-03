"use client";

/**
 * PhoneAuditTable — human-in-the-loop UI for verifying customer phones.
 *
 * Each row shows: customer name · outstanding · phone (editable) · status.
 * Operator can:
 *   - Click ✓ "Verified" — records that this phone is correct
 *   - Click ✗ "Wrong" — clears the phone (and verification)
 *   - Click ✎ "Edit" — change phone inline, then verify
 *
 * Until verified, a customer is excluded from bulk WhatsApp sends.
 */

import { useState, useTransition, useMemo } from "react";
import {
  verifyCustomerPhone,
  unverifyCustomerPhone,
  bulkVerifyPhones,
} from "@/app/actions/phone-audit";
import { updateCustomerContact } from "@/app/actions/reminders";
import { Check, X, Pencil, AlertTriangle, ShieldCheck, Search } from "lucide-react";

type Row = {
  id:            string;
  name:          string;
  phone:         string;
  outstanding:   number;
  daysOverdue:   number;
  verifiedAt:    string | null;
  verifiedPhone: string | null;
};

function fmtINR(n: number) { return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

export function PhoneAuditTable({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [busy, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) =>
      r.name.toLowerCase().includes(q) || r.phone.toLowerCase().includes(q),
    );
  }, [rows, search]);

  const verifiedCount = rows.filter((r) => r.verifiedAt).length;
  const total = rows.length;
  const pct   = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;

  function verify(id: string) {
    startTransition(async () => {
      const r = await verifyCustomerPhone(id);
      if (r.ok) {
        setRows((rs) => rs.map((x) => x.id === id
          ? { ...x, verifiedAt: new Date().toISOString(), verifiedPhone: x.phone }
          : x));
        setToast({ kind: "ok", text: "Verified" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Verify failed" });
      }
    });
  }

  function unverify(id: string) {
    startTransition(async () => {
      const r = await unverifyCustomerPhone(id);
      if (r.ok) {
        setRows((rs) => rs.map((x) => x.id === id
          ? { ...x, verifiedAt: null, verifiedPhone: null }
          : x));
      } else {
        setToast({ kind: "err", text: r.error ?? "Unverify failed" });
      }
    });
  }

  function clearPhone(id: string) {
    if (!confirm("Clear this phone? The customer will then have no phone and won't receive any reminders until you add a new one.")) return;
    startTransition(async () => {
      const r = await updateCustomerContact({ customerId: id, phone: null });
      if (r.ok) {
        setRows((rs) => rs.filter((x) => x.id !== id));
        setToast({ kind: "ok", text: "Phone cleared" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Clear failed" });
      }
    });
  }

  function startEdit(r: Row) { setEditing(r.id); setEditPhone(r.phone); }
  function saveEdit() {
    if (!editing) return;
    const id = editing;
    const phone = editPhone.trim() || null;
    startTransition(async () => {
      const r = await updateCustomerContact({ customerId: id, phone });
      if (r.ok) {
        setRows((rs) => rs.map((x) => x.id === id
          ? { ...x, phone: phone ?? "", verifiedAt: null, verifiedPhone: null }
          : x));
        setEditing(null);
        setToast({ kind: "ok", text: "Phone updated — please re-verify" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Save failed" });
      }
    });
  }

  function verifyAllVisible() {
    if (filtered.length === 0) return;
    if (!confirm(`Mark all ${filtered.length} visible customers as verified? Only do this if you have personally reviewed every phone number on screen.`)) return;
    startTransition(async () => {
      const r = await bulkVerifyPhones(filtered.map((x) => x.id));
      if (r.ok) {
        const now = new Date().toISOString();
        const filteredIds = new Set(filtered.map((x) => x.id));
        setRows((rs) => rs.map((x) => filteredIds.has(x.id)
          ? { ...x, verifiedAt: now, verifiedPhone: x.phone }
          : x));
        setToast({ kind: "ok", text: `Verified ${r.verifiedCount} customers` });
      } else {
        setToast({ kind: "err", text: r.error ?? "Bulk verify failed" });
      }
    });
  }

  return (
    <>
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg px-4 py-3 text-sm cursor-pointer ${toast.kind === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
             onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      {/* Progress hero */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-brand-gray-mid">Verification progress</p>
            <p className="text-xl font-bold text-brand-black"><span className="text-brand-red">{verifiedCount}</span> of {total} verified</p>
          </div>
          <button
            onClick={verifyAllVisible}
            disabled={busy || filtered.length === 0}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-red text-white text-xs font-medium hover:bg-brand-maroon disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Mark all visible as verified
          </button>
        </div>
        <div className="h-2 rounded-full bg-brand-gray-light overflow-hidden">
          <div className="h-full bg-brand-red transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-mid pointer-events-none" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by customer name or phone…"
          className="w-full pl-9 pr-3 h-10 rounded-lg border border-border text-sm focus:outline-none focus:border-brand-red"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-brand-gray-light/60 text-brand-gray-mid text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Customer</th>
              <th className="text-left px-3 py-2 font-medium">Phone</th>
              <th className="text-right px-3 py-2 font-medium">Outstanding</th>
              <th className="text-center px-3 py-2 font-medium">Status</th>
              <th className="text-right px-3 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-brand-gray-mid">No customers match your search.</td></tr>
            )}
            {filtered.map((r) => {
              const isVerified = !!r.verifiedAt;
              const isEditing = editing === r.id;
              return (
                <tr key={r.id} className={isVerified ? "" : "bg-amber-50/30"}>
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-brand-black">{r.name}</p>
                    {r.daysOverdue > 0 && (
                      <p className="text-[10px] text-brand-gray-mid">{r.daysOverdue}d overdue</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isEditing ? (
                      <input
                        autoFocus
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(null); }}
                        className="px-2 h-7 rounded border border-border text-xs font-mono w-32"
                        placeholder="10-digit number"
                      />
                    ) : (
                      <code className="text-xs font-mono text-brand-black">{r.phone || "—"}</code>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-xs text-brand-black">
                    {fmtINR(r.outstanding)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {isVerified
                      ? <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 border border-green-200 px-1.5 py-0.5 rounded"><Check className="w-3 h-3" />Verified</span>
                      : <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded"><AlertTriangle className="w-3 h-3" />Unverified</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={saveEdit} disabled={busy} className="p-1.5 rounded hover:bg-brand-gray-light"><Check className="w-3.5 h-3.5 text-green-600" /></button>
                          <button onClick={() => setEditing(null)} className="p-1.5 rounded hover:bg-brand-gray-light"><X className="w-3.5 h-3.5 text-brand-gray-mid" /></button>
                        </>
                      ) : (
                        <>
                          {!isVerified && (
                            <button onClick={() => verify(r.id)} disabled={busy}
                              title="Verify — phone is correct for this customer"
                              className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50">
                              <Check className="w-3 h-3" />Verify
                            </button>
                          )}
                          {isVerified && (
                            <button onClick={() => unverify(r.id)} disabled={busy}
                              title="Mark this verification as no longer valid"
                              className="inline-flex items-center gap-1 px-2 h-7 rounded text-[11px] font-medium border border-border text-brand-gray-mid hover:text-brand-black hover:bg-brand-gray-light disabled:opacity-50">
                              Unverify
                            </button>
                          )}
                          <button onClick={() => startEdit(r)} disabled={busy}
                            title="Edit phone number"
                            className="p-1.5 rounded hover:bg-brand-gray-light disabled:opacity-50">
                            <Pencil className="w-3.5 h-3.5 text-brand-gray-mid" />
                          </button>
                          <button onClick={() => clearPhone(r.id)} disabled={busy}
                            title="Phone is wrong — clear it"
                            className="p-1.5 rounded hover:bg-red-50 disabled:opacity-50">
                            <X className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-brand-gray-mid text-center">
        💡 Tip: tap a row&apos;s ✎ to fix a wrong phone, then ✓ to mark it verified.
        Use the &quot;Mark all visible as verified&quot; button only after you&apos;ve eyeballed every name + phone.
      </p>
    </>
  );
}
