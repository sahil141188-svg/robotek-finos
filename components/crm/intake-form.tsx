"use client";

import { useState, useTransition } from "react";
import { submitPublicLead } from "@/app/actions/public-leads";
import { CheckCircle2 } from "lucide-react";

export function IntakeForm() {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await submitPublicLead({
        name: String(fd.get("name") ?? ""),
        company: String(fd.get("company") ?? ""),
        phone: String(fd.get("phone") ?? ""),
        email: String(fd.get("email") ?? ""),
        city: String(fd.get("city") ?? ""),
        state: String(fd.get("state") ?? ""),
        lead_type: (String(fd.get("lead_type") ?? "channel_partner") as "channel_partner" | "corporate"),
        notes: String(fd.get("notes") ?? ""),
        honeypot: String(fd.get("company_website") ?? ""),
      });
      if (!r.ok) { setErr(r.error ?? "Something went wrong"); return; }
      setErr(null);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="text-center py-10">
        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
        <h2 className="text-xl font-bold text-brand-black mt-4">Thank you! 🙏</h2>
        <p className="text-brand-gray-mid mt-2">Our team will reach out to you shortly. We appreciate your interest in Robotek India.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

      {/* Honeypot — hidden from humans */}
      <input type="text" name="company_website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Your name *"><input name="name" required className={inputCls} placeholder="Full name" /></Field>
        <Field label="Business name"><input name="company" className={inputCls} placeholder="Shop / company" /></Field>
        <Field label="Phone (WhatsApp)"><input name="phone" className={inputCls} placeholder="+91…" /></Field>
        <Field label="Email"><input name="email" type="email" className={inputCls} /></Field>
        <Field label="City"><input name="city" className={inputCls} /></Field>
        <Field label="State"><input name="state" className={inputCls} /></Field>
      </div>

      <Field label="I am a">
        <select name="lead_type" className={inputCls} defaultValue="channel_partner">
          <option value="channel_partner">Dealer / Distributor / Super Stockist</option>
          <option value="corporate">Brand / OEM / Bulk buyer</option>
        </select>
      </Field>

      <Field label="What are you looking for?">
        <textarea name="notes" rows={3} className={inputCls} placeholder="Products, quantities, or any requirement…" />
      </Field>

      <button type="submit" disabled={pending} className="w-full px-4 py-3 bg-brand-red text-white rounded-lg text-sm font-semibold hover:bg-brand-maroon disabled:opacity-60 transition-colors">
        {pending ? "Submitting…" : "Submit enquiry"}
      </button>
      <p className="text-[11px] text-brand-gray-mid text-center">We'll only use your details to respond to your enquiry.</p>
    </form>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
