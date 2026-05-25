"use client";

/**
 * ReminderCenter — client component for the AR Reminders page.
 *
 *  - Editable phone number per customer (saves via server action)
 *  - Bulk-select + "Send WhatsApp" button
 *  - Single-row send button
 *  - Live preview of the rendered message template
 */

import { useState, useTransition } from "react";
import { fmtAmt } from "@/lib/payables-data";
import { updateCustomerContact, sendArReminder, sendBulkReminders, type OverdueCustomer } from "@/app/actions/reminders";
import { Send, Pencil, Check, X, AlertTriangle, Phone, Mail } from "lucide-react";

interface Props {
  customers: OverdueCustomer[];
  waEnabled: boolean;
  template: string;
}

export function ReminderCenter({ customers: initial, waEnabled, template }: Props) {
  const [customers, setCustomers] = useState<OverdueCustomer[]>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [busy, startTransition] = useTransition();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === customers.length) setSelected(new Set());
    else setSelected(new Set(customers.map((c) => c.id)));
  }

  function startEdit(c: OverdueCustomer) {
    setEditing(c.id);
    setEditPhone(c.phone ?? "");
    setEditEmail(c.email ?? "");
  }

  function saveEdit() {
    if (!editing) return;
    const id = editing;
    const phone = editPhone.trim() || null;
    const email = editEmail.trim() || null;
    startTransition(async () => {
      const r = await updateCustomerContact({ customerId: id, phone, email });
      if (r.ok) {
        setCustomers(customers.map((c) => c.id === id ? { ...c, phone, email } : c));
        setEditing(null);
        setToast({ kind: "ok", text: "Contact saved" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Save failed" });
      }
    });
  }

  function sendOne(c: OverdueCustomer) {
    startTransition(async () => {
      const r = await sendArReminder({
        customerId: c.id,
        amount: c.outstanding,
        dueDate: c.oldestInvoice ?? undefined,
      });
      if (r.sent) setToast({ kind: "ok", text: `Reminder sent to ${c.name}` });
      else setToast({ kind: "err", text: r.error ?? (r.skipped ? "WhatsApp not configured — dry run" : "Send failed") });
    });
  }

  function sendBulk() {
    if (selected.size === 0) return;
    const ids = [...selected];
    startTransition(async () => {
      const r = await sendBulkReminders(ids);
      setToast({
        kind: r.sent > 0 ? "ok" : "err",
        text: `Bulk send: ${r.sent} sent, ${r.skipped} skipped, ${r.failed} failed (${r.total} total)`,
      });
      setSelected(new Set());
    });
  }

  // Live preview of the template for the first selected customer
  const previewFor = customers.find((c) => selected.has(c.id)) ?? customers[0];
  const previewMessage = previewFor
    ? template
        .replace("{customer_name}", previewFor.name)
        .replace("{invoice_no}",   "(consolidated outstanding)")
        .replace("{amount}",       previewFor.outstanding.toLocaleString("en-IN"))
        .replace("{due_date}",     previewFor.oldestInvoice ? new Date(previewFor.oldestInvoice + "T00:00:00").toLocaleDateString("en-IN") : "the agreed date")
        .replace("{company_name}", "Your Company")
    : "(no customer selected)";

  return (
    <>
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg shadow-lg px-4 py-3 text-sm ${toast.kind === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
             onClick={() => setToast(null)}>
          {toast.text}
        </div>
      )}

      {/* Bulk-send bar */}
      <div className="bg-white rounded-xl border border-border p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-brand-black">
            {selected.size === 0 ? "Select customers to message" : `${selected.size} selected`}
          </p>
          <p className="text-xs text-brand-gray-mid">
            {customers.length} customers with outstanding balance · {customers.filter((c) => !c.phone).length} missing phone
          </p>
        </div>
        <button
          disabled={selected.size === 0 || busy}
          onClick={sendBulk}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg px-4 text-xs font-semibold bg-brand-red hover:bg-brand-maroon text-white disabled:bg-brand-gray-mid disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-3.5 h-3.5" /> Send WhatsApp to {selected.size > 0 ? `${selected.size} selected` : "selected"}
        </button>
      </div>

      {/* Message preview */}
      <div className="bg-brand-gray-light/40 rounded-xl border border-border p-4 space-y-2">
        <p className="text-xs font-semibold text-brand-gray-mid uppercase tracking-wide">Message preview</p>
        <pre className="text-xs text-brand-black whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-border">{previewMessage}</pre>
        <p className="text-[10px] text-brand-gray-mid">
          Customise this template under Admin → Notification Settings →
          Templates. Placeholders: <code>{"{customer_name}"}</code>, <code>{"{invoice_no}"}</code>,
          <code>{"{amount}"}</code>, <code>{"{due_date}"}</code>, <code>{"{company_name}"}</code>.
        </p>
      </div>

      {/* Customer table */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-brand-gray-light/50 text-xs text-brand-gray-mid">
                <th className="px-3 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selected.size === customers.length && customers.length > 0}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium">Customer</th>
                <th className="px-3 py-2.5 text-left font-medium w-44">Phone / Email</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Outstanding</th>
                <th className="px-3 py-2.5 text-right font-medium w-24">Overdue</th>
                <th className="px-3 py-2.5 text-right font-medium w-20">Days</th>
                <th className="px-3 py-2.5 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c) => {
                const overdue = c.overdue > 0;
                const missingPhone = !c.phone;
                return (
                  <tr key={c.id} className={`hover:bg-brand-gray-light/40 ${overdue ? "" : ""}`}>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        disabled={missingPhone}
                        onChange={() => toggle(c.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-brand-black">{c.name}</div>
                      {c.gstin && <div className="text-[10px] text-brand-gray-mid font-mono">GSTIN: {c.gstin}</div>}
                    </td>
                    <td className="px-3 py-2.5">
                      {editing === c.id ? (
                        <div className="space-y-1">
                          <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="+91 98xxx xxxxx"
                            className="w-full text-xs border border-border rounded px-2 py-1" />
                          <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                            placeholder="email@example.com"
                            className="w-full text-xs border border-border rounded px-2 py-1" />
                          <div className="flex gap-1">
                            <button onClick={saveEdit} disabled={busy} className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700">
                              <Check className="w-3 h-3" /> Save
                            </button>
                            <button onClick={() => setEditing(null)} className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-brand-gray-mid text-white">
                              <X className="w-3 h-3" /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-0.5">
                          <div className="text-xs flex items-center gap-1">
                            {c.phone ? (
                              <><Phone className="w-3 h-3 text-brand-gray-mid" /><span className="text-brand-black">{c.phone}</span></>
                            ) : (
                              <span className="text-amber-700 inline-flex items-center gap-1 text-[10px]">
                                <AlertTriangle className="w-3 h-3" /> Missing
                              </span>
                            )}
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-brand-gray-mid inline-flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {c.email}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtAmt(c.outstanding)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums font-medium ${overdue ? "text-red-700" : "text-brand-gray-mid"}`}>
                      {overdue ? fmtAmt(c.overdue) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${c.daysOverdue >= 60 ? "text-red-700" : c.daysOverdue >= 30 ? "text-amber-700" : "text-brand-gray-mid"}`}>
                        {c.daysOverdue}d
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {editing === c.id ? null : (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => startEdit(c)}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded border border-border text-brand-gray-mid hover:bg-brand-gray-light"
                            title="Edit phone / email">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button onClick={() => sendOne(c)} disabled={!c.phone || busy || !waEnabled}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded bg-brand-red text-white hover:bg-brand-maroon disabled:bg-brand-gray-mid disabled:cursor-not-allowed"
                            title={!c.phone ? "Add phone first" : !waEnabled ? "WhatsApp not configured" : "Send reminder now"}>
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
