"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createEmailTemplate, toggleEmailTemplate, sendEmail } from "@/app/actions/crm-email";
import type { Database } from "@/types/database";
import { Mail, FileText, Plus, X, Send, Check } from "lucide-react";

type Template = Database["public"]["Tables"]["crm_email_templates"]["Row"];
type LeadLite = { id: string; name: string; email: string | null; company: string | null };
type Tab = "compose" | "templates";

function fill(text: string, name?: string | null, company?: string | null): string {
  return text.replace(/\{\{\s*name\s*\}\}/g, (name ?? "there")).replace(/\{\{\s*company\s*\}\}/g, (company ?? "your business"));
}

export function EmailClient({ templates, leads }: { templates: Template[]; leads: LeadLite[] }) {
  const [tab, setTab] = useState<Tab>("compose");
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-white p-1 max-w-sm">
        <button onClick={() => setTab("compose")} className={tabCls(tab === "compose")}><Mail className="w-4 h-4" />Compose</button>
        <button onClick={() => setTab("templates")} className={tabCls(tab === "templates")}><FileText className="w-4 h-4" />Templates</button>
      </div>
      {tab === "compose" ? <Compose templates={templates} leads={leads} /> : <Templates templates={templates} />}
    </div>
  );
}

function Compose({ templates, leads }: { templates: Template[]; leads: LeadLite[] }) {
  const [leadId, setLeadId] = useState("");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const lead = leads.find((l) => l.id === leadId);

  function applyLead(id: string) {
    setLeadId(id);
    const l = leads.find((x) => x.id === id);
    if (l?.email) setTo(l.email);
  }
  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(fill(t.subject, lead?.name, lead?.company));
    setBody(fill(t.body, lead?.name, lead?.company));
  }
  function send() {
    start(async () => {
      const r = await sendEmail({ to, subject, body, leadId: leadId || null });
      if (r.error) { setErr(r.error); setDone(false); return; }
      setErr(null); setDone(true);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-white p-5 space-y-3">
      {err && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{err}</div>}
      {done && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 flex items-center gap-2"><Check className="w-4 h-4" />Email sent.</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Pick a lead (optional — fills email + placeholders)">
          <select value={leadId} onChange={(e) => applyLead(e.target.value)} className={inputCls}>
            <option value="">— none —</option>
            {leads.filter((l) => l.email).map((l) => <option key={l.id} value={l.id}>{l.name}{l.company ? ` (${l.company})` : ""}</option>)}
          </select>
        </Field>
        <Field label="Use a template">
          <select onChange={(e) => applyTemplate(e.target.value)} defaultValue="" className={inputCls}>
            <option value="">— none —</option>
            {templates.filter((t) => t.is_active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </Field>
      </div>
      <Field label="To *"><input value={to} onChange={(e) => setTo(e.target.value)} type="email" className={inputCls} placeholder="customer@email.com" /></Field>
      <Field label="Subject *"><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputCls} /></Field>
      <Field label="Body *"><textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} className={inputCls} placeholder="Write your email… {{name}} and {{company}} are auto-filled when a lead is selected." /></Field>
      <div className="flex justify-end">
        <button onClick={send} disabled={pending || !to || !subject || !body} className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">
          <Send className="w-4 h-4" />{pending ? "Sending…" : "Send Email"}
        </button>
      </div>
    </div>
  );
}

function Templates({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await createEmailTemplate(fd);
      if (r.error) { setErr(r.error); return; }
      setErr(null); form.reset(); setOpen(false); router.refresh();
    });
  }
  function toggle(id: string, active: boolean) {
    start(async () => { await toggleEmailTemplate(id, active); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-gray-mid">{templates.length} templates</p>
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon transition-colors">
          {open ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}{open ? "Close" : "New Template"}
        </button>
      </div>
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {open && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Template name *"><input name="name" required className={inputCls} placeholder="Intro to dealers" /></Field>
            <Field label="Category"><input name="category" className={inputCls} placeholder="Intro, Follow-up…" /></Field>
          </div>
          <Field label="Subject *"><input name="subject" required className={inputCls} placeholder="Partner with Robotek India" /></Field>
          <Field label="Body * (use {{name}} / {{company}})"><textarea name="body" required rows={6} className={inputCls} /></Field>
          <div className="flex justify-end"><button type="submit" disabled={pending} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60 transition-colors">{pending ? "Saving…" : "Save Template"}</button></div>
        </form>
      )}

      <div className="space-y-2">
        {templates.length === 0 && <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-brand-gray-mid">No templates yet.</div>}
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-brand-black">{t.name}</span>
                {t.category && <span className="ml-2 text-[10px] bg-brand-gray-light text-brand-gray-mid rounded px-1.5 py-0.5">{t.category}</span>}
              </div>
              <button onClick={() => toggle(t.id, !t.is_active)} disabled={pending}
                className={`text-xs rounded-full px-2 py-0.5 font-medium ${t.is_active ? "bg-emerald-100 text-emerald-700" : "bg-brand-gray-light text-brand-gray-mid"}`}>
                {t.is_active ? "Active" : "Inactive"}
              </button>
            </div>
            <div className="text-xs text-brand-gray-mid mt-1">{t.subject}</div>
            <p className="text-xs text-brand-gray-mid mt-2 whitespace-pre-wrap line-clamp-3">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
function tabCls(active: boolean) {
  return `flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${active ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"}`;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
