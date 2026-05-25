"use client";

/**
 * ReminderCenter — daily WhatsApp reminder list with one-click send.
 *
 *  - Big "Send Today's Reminders" button = sends to every eligible customer
 *    (has phone, not in cooldown), with a 3-day cooldown per customer and
 *    2s gap between API calls (both configurable in app_settings.reminders).
 *  - Per-row "send now" button bypasses the queue for a single customer.
 *  - Inline edit phone / email for any customer.
 *  - Live preview of the rendered message using the first eligible customer.
 *  - Result panel after a bulk send shows sent/skipped/failed counts per row.
 */

import { useState, useTransition } from "react";
import { fmtAmt } from "@/lib/payables-data";
import {
  updateCustomerContact, sendArReminder, sendAllTodaysReminders,
  type OverdueCustomer, type BulkResult,
} from "@/app/actions/reminders";
import { Send, Pencil, Check, X, AlertTriangle, Phone, Mail, Clock, Zap } from "lucide-react";

interface Props {
  customers: OverdueCustomer[];
  waEnabled: boolean;
  template: string;
  cooldownDays: number;
  companyName: string;
}

function fmtINR(n: number) { return n.toLocaleString("en-IN", { maximumFractionDigits: 0 }); }

function previewMessage(template: string, c: OverdueCustomer, companyName: string) {
  return template
    .replace(/\{customer_name\}/g, c.name)
    .replace(/\{amount\}/g,        fmtINR(c.outstanding))
    .replace(/\{due_date\}/g,      c.oldestInvoice
      ? new Date(c.oldestInvoice + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "the agreed date")
    .replace(/\{days_overdue\}/g,  String(c.daysOverdue))
    .replace(/\{invoice_no\}/g,    "(consolidated outstanding)")
    .replace(/\{company_name\}/g,  companyName);
}

export function ReminderCenter({ customers: initial, waEnabled, template, cooldownDays, companyName }: Props) {
  const [customers, setCustomers] = useState<OverdueCustomer[]>(initial);
  const [editing, setEditing]     = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [busy, startTransition]   = useTransition();
  const [toast, setToast]         = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [bulkResult, setBulkResult] = useState<(BulkResult & { totalEligible: number }) | null>(null);

  const eligible      = customers.filter((c) => c.eligibleToday);
  const missingPhone  = customers.filter((c) => !c.phone);
  const inCooldown    = customers.filter((c) => c.phone && !c.eligibleToday);
  const previewCust   = eligible[0] ?? customers[0];

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
        setCustomers(customers.map((c) => c.id === id
          ? { ...c, phone, email,
              eligibleToday: !!phone && c.daysSinceLastReminder === null,
              reason: !phone ? "No phone number" : c.reason }
          : c));
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
        oldestInvoiceDate: c.oldestInvoice,
        daysOverdue: c.daysOverdue,
      });
      if (r.sent)         setToast({ kind: "ok",  text: `Reminder sent to ${c.name}` });
      else if (r.skipped) setToast({ kind: "err", text: r.error ?? "Skipped" });
      else                setToast({ kind: "err", text: r.error ?? "Send failed" });
    });
  }

  function sendAll() {
    if (eligible.length === 0) {
      setToast({ kind: "err", text: "No eligible customers to message." });
      return;
    }
    const ok = confirm(
      `Send WhatsApp payment reminder to ${eligible.length} customer${eligible.length === 1 ? "" : "s"}?\n\n` +
      `Cooldown: each customer gets at most one reminder every ${cooldownDays} days.\n` +
      `Customers already messaged within the last ${cooldownDays} days will be skipped.`,
    );
    if (!ok) return;
    startTransition(async () => {
      setBulkResult(null);
      const r = await sendAllTodaysReminders();
      setBulkResult(r);
      setToast({
        kind: r.sent > 0 ? "ok" : "err",
        text: `Done. ${r.sent} sent · ${r.skipped} skipped · ${r.failed} failed`,
      });
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

      {/* ── HERO: Today's list + one-click button ──────────────────────── */}
      <div className="bg-gradient-to-br from-brand-red to-brand-maroon text-white rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">Today&apos;s reminder list</p>
            <h2 className="text-3xl font-bold mt-1">{eligible.length} {eligible.length === 1 ? "customer" : "customers"}</h2>
            <p className="text-xs opacity-90 mt-1">
              eligible right now ·
              {" "}{missingPhone.length} need a phone number ·
              {" "}{inCooldown.length} in {cooldownDays}-day cooldown
            </p>
          </div>
          <button
            onClick={sendAll}
            disabled={eligible.length === 0 || busy || !waEnabled}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-red font-bold text-sm hover:bg-brand-yellow transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            <Zap className="w-4 h-4" />
            {busy ? "Sending…" : `Send Today's Reminders (${eligible.length})`}
          </button>
        </div>
        {!waEnabled && (
          <p className="text-xs opacity-90 border-t border-white/20 pt-3">
            ⚠ WhatsApp credentials not configured — messages will be drafted but not delivered. Set up in Admin → Notification Settings.
          </p>
        )}
        {waEnabled && (
          <p className="text-xs opacity-90 border-t border-white/20 pt-3">
            ✓ Each customer gets a personalised message with their firm name &amp; outstanding balance.
            Min {cooldownDays}-day gap between reminders to the same customer.
          </p>
        )}
      </div>

      {/* ── Message preview ────────────────────────────────────────────── */}
      {previewCust && (
        <div className="bg-brand-gray-light/40 rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-brand-gray-mid uppercase tracking-wide">Message preview</p>
            <p className="text-[10px] text-brand-gray-mid">Will read: <strong>{previewCust.name}</strong></p>
          </div>
          <pre className="text-xs text-brand-black whitespace-pre-wrap font-sans bg-white rounded-lg p-3 border border-border">{previewMessage(template, previewCust, companyName)}</pre>
          <p className="text-[10px] text-brand-gray-mid">
            Edit the template in Admin → Notification Settings. Placeholders auto-fill per customer.
          </p>
        </div>
      )}

      {/* ── Bulk result panel ──────────────────────────────────────────── */}
      {bulkResult && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-brand-black">Last bulk send</p>
            <button onClick={() => setBulkResult(null)} className="text-xs text-brand-gray-mid hover:text-brand-black">Dismiss</button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="bg-brand-gray-light rounded-lg p-2"><p className="text-brand-gray-mid">Eligible</p><p className="text-lg font-bold">{bulkResult.totalEligible}</p></div>
            <div className="bg-green-50 rounded-lg p-2"><p className="text-green-700">Sent</p><p className="text-lg font-bold text-green-700">{bulkResult.sent}</p></div>
            <div className="bg-amber-50 rounded-lg p-2"><p className="text-amber-700">Skipped</p><p className="text-lg font-bold text-amber-700">{bulkResult.skipped}</p></div>
            <div className="bg-red-50 rounded-lg p-2"><p className="text-red-700">Failed</p><p className="text-lg font-bold text-red-700">{bulkResult.failed}</p></div>
          </div>
          {bulkResult.results.some((r) => r.status !== "sent") && (
            <details className="text-xs">
              <summary className="cursor-pointer text-brand-gray-mid">View per-customer outcomes</summary>
              <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                {bulkResult.results.filter((r) => r.status !== "sent").map((r) => (
                  <li key={r.customerId} className="flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${r.status === "skipped" ? "bg-amber-500" : "bg-red-500"}`} />
                    <span className="font-medium text-brand-black truncate">{r.customerName}</span>
                    <span className="text-brand-gray-mid">— {r.error ?? r.status}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* ── Customer table ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-brand-gray-light/50 text-xs text-brand-gray-mid">
                <th className="px-3 py-2.5 text-left font-medium w-6">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Customer (firm)</th>
                <th className="px-3 py-2.5 text-left font-medium w-44">Phone / Email</th>
                <th className="px-3 py-2.5 text-right font-medium w-28">Outstanding</th>
                <th className="px-3 py-2.5 text-right font-medium w-20">Days</th>
                <th className="px-3 py-2.5 text-left font-medium w-40">Last reminder</th>
                <th className="px-3 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {customers.map((c, idx) => {
                const eligibleNow = c.eligibleToday;
                const dotClass = !c.phone ? "bg-brand-gray-mid"
                  : eligibleNow ? "bg-green-500"
                  : "bg-amber-500";
                return (
                  <tr key={c.id} className={`hover:bg-brand-gray-light/40 ${!c.phone ? "opacity-70" : ""}`}>
                    <td className="px-3 py-2.5 text-xs text-brand-gray-mid">
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass} mr-1`} />
                      {idx + 1}
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
                                <AlertTriangle className="w-3 h-3" /> No phone
                              </span>
                            )}
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-brand-gray-mid inline-flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{c.email}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">{fmtAmt(c.outstanding)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-medium ${c.daysOverdue >= 60 ? "text-red-700" : c.daysOverdue >= 30 ? "text-amber-700" : "text-brand-gray-mid"}`}>
                        {c.daysOverdue}d
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {c.lastReminderAt ? (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-brand-gray-mid shrink-0" />
                          <div>
                            <div className="text-brand-black">{c.daysSinceLastReminder}d ago</div>
                            <div className="text-[10px] text-brand-gray-mid">{new Date(c.lastReminderAt).toLocaleDateString("en-IN")}</div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-brand-gray-mid italic">Never</span>
                      )}
                      {!eligibleNow && c.reason && (
                        <div className="text-[10px] text-amber-700 mt-0.5">{c.reason}</div>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {editing === c.id ? null : (
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => startEdit(c)}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded border border-border text-brand-gray-mid hover:bg-brand-gray-light"
                            title="Edit phone / email">
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => sendOne(c)}
                            disabled={!eligibleNow || busy || !waEnabled}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded bg-brand-red text-white hover:bg-brand-maroon disabled:bg-brand-gray-mid disabled:cursor-not-allowed"
                            title={!c.phone ? "Add phone first" : !waEnabled ? "WhatsApp not configured" : !eligibleNow ? (c.reason ?? "Not eligible") : "Send now"}>
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
