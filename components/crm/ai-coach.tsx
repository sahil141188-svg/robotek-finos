"use client";

import { useState, useTransition } from "react";
import { getDailyPlan, draftReply, handleObjection, type CoachResult } from "@/app/actions/crm-ai";
import { LEAD_TYPE_LABELS } from "@/lib/crm/drip";
import type { CrmLeadType } from "@/types/database";
import {
  Sparkles, ListChecks, MessageSquareReply, ShieldQuestion,
  Copy, Check, RefreshCw, Send,
} from "lucide-react";

type LeadLite = { id: string; name: string; company: string | null; phone: string | null; lead_type: CrmLeadType };
type Tab = "today" | "reply" | "objection";

const QUICK_OBJECTIONS = ["Price is too high", "Already have a supplier", "Not sure about quality", "MOQ too high", "Delivery / lead time"];

function waLink(phone: string | null, text: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 10) digits = "91" + digits;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function AiCoach({ leads }: { leads: LeadLite[] }) {
  const [tab, setTab] = useState<Tab>("today");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-white p-1">
        <TabBtn active={tab === "today"} onClick={() => setTab("today")} icon={<ListChecks className="w-4 h-4" />}>Do Now</TabBtn>
        <TabBtn active={tab === "reply"} onClick={() => setTab("reply")} icon={<MessageSquareReply className="w-4 h-4" />}>Draft Reply</TabBtn>
        <TabBtn active={tab === "objection"} onClick={() => setTab("objection")} icon={<ShieldQuestion className="w-4 h-4" />}>Objections</TabBtn>
      </div>

      {tab === "today" && <TodayPanel />}
      {tab === "reply" && <ReplyPanel leads={leads} />}
      {tab === "objection" && <ObjectionPanel />}
    </div>
  );
}

// ── Do Now ──────────────────────────────────────────────────

function TodayPanel() {
  const [result, setResult] = useState<CoachResult | null>(null);
  const [pending, start] = useTransition();

  function run() {
    start(async () => setResult(await getDailyPlan()));
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">Your prioritized actions for right now — overdue follow-ups, hot deals, and qualified leads.</p>
        <button onClick={run} disabled={pending} className={primaryBtn}>
          {pending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {pending ? "Thinking…" : result ? "Refresh" : "What should I do now?"}
        </button>
      </div>
      {result && <ResultBlock result={result} />}
    </Card>
  );
}

// ── Draft Reply ─────────────────────────────────────────────

function ReplyPanel({ leads }: { leads: LeadLite[] }) {
  const [enquiry, setEnquiry] = useState("");
  const [leadId, setLeadId] = useState("");
  const [tone, setTone] = useState<"warm" | "professional" | "concise">("warm");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [pending, start] = useTransition();

  const lead = leads.find((l) => l.id === leadId);

  function run() {
    start(async () => {
      const r = await draftReply({
        enquiry,
        leadName: lead?.name ?? null,
        company: lead?.company ?? null,
        leadType: lead?.lead_type ?? null,
        tone,
      });
      setResult(r);
    });
  }

  return (
    <Card>
      <p className="text-sm text-brand-gray-mid">Paste an enquiry or customer message — get a ready-to-send WhatsApp reply.</p>
      <textarea
        value={enquiry} onChange={(e) => setEnquiry(e.target.value)} rows={4}
        placeholder="e.g. Hi, do you make Type-C fast charging cables? What's your dealer price for 1000 pcs?"
        className={inputCls}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className={labelCls}>Lead (optional — adds context)</span>
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)} className={inputCls}>
            <option value="">— not linked —</option>
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name}{l.company ? ` (${l.company})` : ""}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Tone</span>
          <select value={tone} onChange={(e) => setTone(e.target.value as typeof tone)} className={inputCls}>
            <option value="warm">Warm</option>
            <option value="professional">Professional</option>
            <option value="concise">Concise</option>
          </select>
        </label>
      </div>
      <div className="flex justify-end">
        <button onClick={run} disabled={pending || !enquiry.trim()} className={primaryBtn}>
          {pending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {pending ? "Drafting…" : "Draft reply"}
        </button>
      </div>
      {result && <ResultBlock result={result} waHref={waLink(lead?.phone ?? null, result.text)} />}
    </Card>
  );
}

// ── Objections ──────────────────────────────────────────────

function ObjectionPanel() {
  const [objection, setObjection] = useState("");
  const [leadType, setLeadType] = useState<"" | CrmLeadType>("");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [pending, start] = useTransition();

  function run(obj?: string) {
    const text = obj ?? objection;
    if (obj) setObjection(obj);
    start(async () => {
      const r = await handleObjection({ objection: text, leadType: leadType || null });
      setResult(r);
    });
  }

  return (
    <Card>
      <p className="text-sm text-brand-gray-mid">What did the customer push back on? Get 2-3 ways to respond.</p>
      <div className="flex flex-wrap gap-2">
        {QUICK_OBJECTIONS.map((q) => (
          <button key={q} onClick={() => run(q)} disabled={pending}
            className="text-xs rounded-full border border-border px-3 py-1.5 text-brand-gray-mid hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-60">
            {q}
          </button>
        ))}
      </div>
      <textarea
        value={objection} onChange={(e) => setObjection(e.target.value)} rows={2}
        placeholder="Type the objection in your own words…"
        className={inputCls}
      />
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="block">
          <span className={labelCls}>Buyer type (optional)</span>
          <select value={leadType} onChange={(e) => setLeadType(e.target.value as "" | CrmLeadType)} className={inputCls}>
            <option value="">— any —</option>
            <option value="channel_partner">{LEAD_TYPE_LABELS.channel_partner}</option>
            <option value="corporate">{LEAD_TYPE_LABELS.corporate}</option>
          </select>
        </label>
        <button onClick={() => run()} disabled={pending || !objection.trim()} className={primaryBtn}>
          {pending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {pending ? "Thinking…" : "Get responses"}
        </button>
      </div>
      {result && <ResultBlock result={result} />}
    </Card>
  );
}

// ── Shared bits ─────────────────────────────────────────────

function ResultBlock({ result, waHref }: { result: CoachResult; waHref?: string | null }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(result.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div className="mt-4 rounded-lg border border-border bg-brand-gray-light/40 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${result.ai ? "bg-emerald-100 text-emerald-700" : "bg-brand-gray-light text-brand-gray-mid"}`}>
          {result.ai ? "AI" : "Suggested"}
        </span>
        <div className="flex items-center gap-2">
          {waHref && (
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
              <Send className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
          <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-black">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <p className="text-sm text-brand-black whitespace-pre-wrap leading-relaxed">{result.text}</p>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-white p-5 space-y-3">{children}</div>;
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"}`}>
      {icon}{children}
    </button>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
const labelCls = "text-xs font-medium text-brand-gray-mid mb-1 block";
const primaryBtn = "inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors shrink-0";
