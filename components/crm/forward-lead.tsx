"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { shareLead } from "@/app/actions/crm";
import type { LeadWithNames } from "@/lib/crm/queries";
import { Share2, X, Send, Copy, Check } from "lucide-react";

export type ExpertTarget = { id: string; full_name: string; crm_team_role: string; whatsapp_number: string | null };
export type SsTarget = { id: string; name: string; phone: string | null; city: string | null; state: string | null };

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.length === 10) d = "91" + d;
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(text)}` : null;
}

function buildMessage(l: LeadWithNames): string {
  const lines = [
    "*Robotek — Lead details*",
    `Name: ${l.name}`,
    l.company ? `Firm: ${l.company}` : "",
    l.phone ? `Phone: ${l.phone}` : "",
    [l.city, l.state].filter(Boolean).length ? `Area: ${[l.city, l.state].filter(Boolean).join(", ")}` : "",
    l.enquiry_type ? `Type: ${l.enquiry_type}` : "",
    l.product_interest ? `Interested in: ${l.product_interest}` : "",
    l.notes ? `Notes: ${l.notes}` : "",
    "",
    "Please connect with them. Thanks!",
  ].filter(Boolean);
  return lines.join("\n");
}

/** Forward a lead to an FSR/Sales Expert, or transfer to a Super Stockist. */
export function ForwardLead({
  lead, experts, superStockists,
}: { lead: LeadWithNames; experts: ExpertTarget[]; superStockists: SsTarget[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"internal" | "ss">("internal");
  const [userId, setUserId] = useState("");
  const [ssId, setSsId] = useState("");
  const [assign, setAssign] = useState(true);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // SS suggestions: same-state first
  const sortedSs = useMemo(() => {
    const st = (lead.state ?? "").trim().toLowerCase();
    return [...superStockists].sort((a, b) => {
      const am = (a.state ?? "").trim().toLowerCase() === st && st ? 0 : 1;
      const bm = (b.state ?? "").trim().toLowerCase() === st && st ? 0 : 1;
      return am - bm;
    });
  }, [superStockists, lead.state]);

  function openModal() {
    setMsg(buildMessage(lead));
    setErr(null);
    setOpen(true);
  }

  const expert = experts.find((e) => e.id === userId);
  const ss = superStockists.find((s) => s.id === ssId);
  const recipientPhone = tab === "internal" ? expert?.whatsapp_number ?? null : ss?.phone ?? null;
  const recipientName = tab === "internal" ? expert?.full_name ?? null : ss?.name ?? null;
  const href = waLink(recipientPhone, msg);

  function record(openWa: boolean) {
    if (tab === "internal" && !userId) { setErr("Pick an FSR / Sales Expert"); return; }
    if (tab === "ss" && !ssId) { setErr("Pick a Super Stockist"); return; }
    start(async () => {
      const r = await shareLead({
        leadId: lead.id,
        shareType: tab === "ss" ? "ss" : (expert?.crm_team_role === "fsr" ? "fsr" : "sales_expert"),
        toUserId: tab === "internal" ? userId : null,
        toAccountId: tab === "ss" ? ssId : null,
        toName: recipientName,
        message: msg,
        assign: tab === "internal" && assign,
      });
      if (r.error) { setErr(r.error); return; }
      setErr(null);
      if (openWa && href) window.open(href, "_blank");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={openModal} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline" title="Forward to FSR/Sales Expert or transfer to a Super Stockist">
        <Share2 className="w-3.5 h-3.5" /> Forward
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black flex items-center gap-2"><Share2 className="w-4 h-4 text-brand-red" /> Forward / transfer — {lead.name}</h3>
              <button onClick={() => setOpen(false)} className="text-brand-gray-mid hover:text-brand-black"><X className="w-4 h-4" /></button>
            </div>

            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            <div className="flex gap-2">
              <button onClick={() => setTab("internal")} className={tabCls(tab === "internal")}>FSR / Sales Expert</button>
              <button onClick={() => setTab("ss")} className={tabCls(tab === "ss")}>Super Stockist</button>
            </div>

            {tab === "internal" ? (
              <>
                <Field label="Forward to">
                  <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputCls}>
                    <option value="">— select —</option>
                    {experts.map((e) => <option key={e.id} value={e.id}>{e.full_name} · {e.crm_team_role === "fsr" ? "FSR" : "Sales Expert"}{e.whatsapp_number ? "" : " (no WhatsApp #)"}</option>)}
                  </select>
                  {experts.length === 0 && <p className="text-[11px] text-amber-700 mt-1">No FSRs / Sales Experts yet — create them in Admin with that sales role.</p>}
                </Field>
                <label className="flex items-center gap-2 text-xs text-brand-gray-mid">
                  <input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} /> Also assign this lead to them
                </label>
              </>
            ) : (
              <Field label="Transfer to Super Stockist (same-area shown first)">
                <select value={ssId} onChange={(e) => setSsId(e.target.value)} className={inputCls}>
                  <option value="">— select —</option>
                  {sortedSs.map((s) => {
                    const same = (s.state ?? "").trim().toLowerCase() === (lead.state ?? "").trim().toLowerCase() && lead.state;
                    return <option key={s.id} value={s.id}>{s.name}{s.state ? ` · ${s.state}` : ""}{same ? " ✓ same area" : ""}{s.phone ? "" : " (no phone)"}</option>;
                  })}
                </select>
                {superStockists.length === 0 && <p className="text-[11px] text-amber-700 mt-1">No Super Stockist accounts yet — add them under Accounts (type = Super Stockist).</p>}
                <p className="text-[11px] text-brand-gray-mid mt-1">Transferring tags the lead “transferred-to-SS”.</p>
              </Field>
            )}

            <Field label="Message (sent on WhatsApp)">
              <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={8} className={`${inputCls} font-mono text-xs`} />
            </Field>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                onClick={() => { navigator.clipboard?.writeText(msg).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
                className="inline-flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-black"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}{copied ? "Copied" : "Copy details"}
              </button>
              <div className="flex gap-2">
                <button onClick={() => record(false)} disabled={pending} className="px-3 py-2 rounded-lg border border-border text-sm disabled:opacity-60">Record only</button>
                <button onClick={() => record(true)} disabled={pending || !recipientPhone} className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60" title={recipientPhone ? "" : "Recipient has no phone/WhatsApp number"}>
                  <Send className="w-4 h-4" />{pending ? "…" : "WhatsApp & record"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
function tabCls(active: boolean) {
  return `flex-1 px-3 py-2 rounded-lg border text-sm font-medium ${active ? "border-brand-red bg-brand-red/5 text-brand-red" : "border-border text-brand-gray-mid hover:text-brand-black"}`;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
