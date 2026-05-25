"use client";

/**
 * ReminderCenter — daily WhatsApp reminder list with one-click send and
 * an explicit "excluded — missing info" section.
 *
 * Three stacked sections:
 *   1. Eligible today → big "Send Today's Reminders" button.
 *   2. Excluded — missing phone → highlighted, with inline phone-fix UX
 *      so the accountant can patch them mid-flow and immediately become
 *      eligible.
 *   3. Cooldown (collapsed by default) → customers messaged in the last
 *      N days; shows next-eligible date.
 *
 * Plus an "All outstanding" table at the bottom for transparency.
 */

import { useState, useTransition, useMemo } from "react";
import { fmtAmt } from "@/lib/payables-data";
import {
  updateCustomerContact, sendArReminder, sendAllTodaysReminders,
  type OverdueCustomer, type BulkResult,
} from "@/app/actions/reminders";
import {
  Send, Pencil, Check, X, AlertTriangle, Phone, Mail, Clock, Zap,
  AlertCircle, ChevronDown, ChevronRight,
} from "lucide-react";
import Link from "next/link";

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
  const [showCooldown, setShowCooldown] = useState(false);
  const [showAll, setShowAll]           = useState(false);

  const eligible      = useMemo(() => customers.filter((c) => c.eligibleToday), [customers]);
  const missingPhone  = useMemo(() => customers.filter((c) => !c.phone), [customers]);
  const inCooldown    = useMemo(() => customers.filter((c) => c.phone && !c.eligibleToday), [customers]);
  const previewCust   = eligible[0] ?? customers[0];
  const missingOutstanding = useMemo(() => missingPhone.reduce((s, c) => s + c.outstanding, 0), [missingPhone]);

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
          ? {
              ...c, phone, email,
              eligibleToday: !!phone && c.daysSinceLastReminder === null,
              reason: !phone ? "No phone number" : c.reason,
            }
          : c));
        setEditing(null);
        setToast({ kind: "ok", text: phone ? "Phone saved — now eligible for reminders" : "Saved" });
      } else {
        setToast({ kind: "err", text: r.error ?? "Save failed" });
      }
    });
  }

  function sendOne(c: OverdueCustomer) {
    startTransition(async () => {
      const r = await sendArReminder({
        customerId: c.id, amount: c.outstanding,
        oldestInvoiceDate: c.oldestInvoice, daysOverdue: c.daysOverdue,
      });
      if (r.sent)         setToast({ kind: "ok",  text: `Reminder sent to ${c.name}` });
      else if (r.skipped) setToast({ kind: "err", text: r.error ?? "Skipped" });
      else                setToast({ kind: "err", text: r.error ?? "Send failed" });
    });
  }

  function sendAll() {
    if (eligible.length === 0) { setToast({ kind: "err", text: "No eligible customers to message." }); return; }
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

      {/* ── HERO: Today's list + one-click button ────────────────────── */}
      <div className="bg-gradient-to-br from-brand-red to-brand-maroon text-white rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide opacity-80">Today&apos;s reminder list</p>
            <h2 className="text-3xl font-bold mt-1">{eligible.length} {eligible.length === 1 ? "customer" : "customers"}</h2>
            <p className="text-xs opacity-90 mt-1">
              eligible right now ·
              {" "}<span className={missingPhone.length > 0 ? "underline cursor-help" : ""} title="See the 'Missing info' section below">{missingPhone.length} need a phone number</span> ·
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

      {/* ── MISSING INFO — prominently surfaced ──────────────────────── */}
      {missingPhone.length > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200 bg-amber-100/50 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-amber-900">
                {missingPhone.length} customer{missingPhone.length === 1 ? "" : "s"} excluded — missing phone number
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                These customers have <strong>{fmtAmt(missingOutstanding)}</strong> outstanding
                between them but won&apos;t receive reminders until you add their phone.
                Fix below inline, or {" "}
                <Link href="/dashboard/contacts" className="font-semibold underline">bulk-import from a sheet →</Link>
              </p>
            </div>
          </div>
          <div className="divide-y divide-amber-200">
            {missingPhone.map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center gap-3 hover:bg-amber-100/30">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-black truncate">{c.name}</p>
                  <p className="text-[10px] text-brand-gray-mid">
                    <span className="text-amber-700 font-medium">{fmtAmt(c.outstanding)} outstanding</span>
                    {c.daysOverdue > 0 && <> · {c.daysOverdue}d overdue</>}
                    {c.gstin && <> · GSTIN {c.gstin}</>}
                  </p>
                </div>
                {editing === c.id ? (
                  <div className="flex flex-col gap-1 w-72">
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="+91 98xxx xxxxx" autoFocus
                      className="text-xs border border-amber-300 rounded px-2 py-1 bg-white" />
                    <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="email (optional)"
                      className="text-xs border border-amber-300 rounded px-2 py-1 bg-white" />
                    <div className="flex gap-1 justify-end">
                      <button onClick={saveEdit} disabled={busy || !editPhone.trim()}
                        className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-brand-gray-mid">
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditing(null)} className="text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-brand-gray-mid text-white">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startEdit(c)}
                    className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700">
                    <Phone className="w-3 h-3" /> Add phone
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MESSAGE PREVIEW ─────────────────────────────────────────── */}
      {previewCust && previewCust.phone && (
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

      {/* ── BULK RESULT ─────────────────────────────────────────────── */}
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

      {/* ── COOLDOWN section (collapsed) ────────────────────────────── */}
      {inCooldown.length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <button onClick={() => setShowCooldown(!showCooldown)}
            className="w-full px-5 py-3 flex items-center justify-between hover:bg-brand-gray-light/40 transition-colors">
            <div className="flex items-center gap-2">
              {showCooldown ? <ChevronDown className="w-4 h-4 text-brand-gray-mid" /> : <ChevronRight className="w-4 h-4 text-brand-gray-mid" />}
              <h3 className="text-sm font-semibold text-brand-black">
                {inCooldown.length} in {cooldownDays}-day cooldown
              </h3>
            </div>
            <p className="text-[10px] text-brand-gray-mid">Already messaged recently — will become eligible again automatically</p>
          </button>
          {showCooldown && (
            <div className="divide-y divide-border border-t border-border">
              {inCooldown.map((c) => (
                <div key={c.id} className="px-5 py-2.5 flex items-center gap-3 text-xs">
                  <div className="flex-1">
                    <p className="font-medium text-brand-black">{c.name}</p>
                    <p className="text-[10px] text-brand-gray-mid">
                      <Clock className="w-2.5 h-2.5 inline" /> Last sent {c.daysSinceLastReminder}d ago ·
                      {" "}eligible again in {cooldownDays - (c.daysSinceLastReminder ?? 0)}d ·
                      {" "}{fmtAmt(c.outstanding)} outstanding
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ALL OUTSTANDING — full table (collapsed) ────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <button onClick={() => setShowAll(!showAll)}
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-brand-gray-light/40">
          <div className="flex items-center gap-2">
            {showAll ? <ChevronDown className="w-4 h-4 text-brand-gray-mid" /> : <ChevronRight className="w-4 h-4 text-brand-gray-mid" />}
            <h3 className="text-sm font-semibold text-brand-black">All customers with outstanding ({customers.length})</h3>
          </div>
          <p className="text-[10px] text-brand-gray-mid">Full table with phone, last reminder, and send button</p>
        </button>
        {showAll && (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-gray-light/50 text-xs text-brand-gray-mid">
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
                  const dotClass = !c.phone ? "bg-brand-gray-mid" : eligibleNow ? "bg-green-500" : "bg-amber-500";
                  return (
                    <tr key={c.id} className={`hover:bg-brand-gray-light/40 ${!c.phone ? "opacity-70" : ""}`}>
                      <td className="px-3 py-2.5 text-xs text-brand-gray-mid">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${dotClass} mr-1`} />{idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-brand-black">{c.name}</div>
                        {c.gstin && <div className="text-[10px] text-brand-gray-mid font-mono">GSTIN: {c.gstin}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          <div className="text-xs flex items-center gap-1">
                            {c.phone
                              ? <><Phone className="w-3 h-3 text-brand-gray-mid" /><span className="text-brand-black">{c.phone}</span></>
                              : <span className="text-amber-700 inline-flex items-center gap-1 text-[10px]"><AlertTriangle className="w-3 h-3" /> No phone</span>}
                          </div>
                          {c.email && (
                            <div className="text-[10px] text-brand-gray-mid inline-flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{c.email}</span>
                            </div>
                          )}
                        </div>
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
                        ) : <span className="text-[10px] text-brand-gray-mid italic">Never</span>}
                        {!eligibleNow && c.reason && (
                          <div className="text-[10px] text-amber-700 mt-0.5">{c.reason}</div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => startEdit(c)}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded border border-border text-brand-gray-mid hover:bg-brand-gray-light"
                            title="Edit phone / email"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => sendOne(c)} disabled={!eligibleNow || busy || !waEnabled}
                            className="text-[10px] inline-flex items-center gap-0.5 px-2 py-1 rounded bg-brand-red text-white hover:bg-brand-maroon disabled:bg-brand-gray-mid disabled:cursor-not-allowed"
                            title={!c.phone ? "Add phone first" : !waEnabled ? "WhatsApp not configured" : !eligibleNow ? (c.reason ?? "Not eligible") : "Send now"}>
                            <Send className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
