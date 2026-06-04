"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { arrangeMeeting } from "@/app/actions/crm-meetings";
import type { CrmMeetingMode } from "@/types/database";
import { CalendarClock, X, MapPin, Video, Phone } from "lucide-react";

export type MeetingTarget = { id: string; full_name: string; crm_team_role: string };

const ROLE_LABEL: Record<string, string> = { sales_expert: "Sales Expert", fsr: "FSR" };

/** Button + modal to assign a lead and schedule a meeting with a Sales Expert / FSR. */
export function ArrangeMeeting({
  leadId, leadName, targets, defaultNotes, compact,
}: {
  leadId: string; leadName: string; targets: MeetingTarget[]; defaultNotes?: string | null; compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CrmMeetingMode>("physical");
  const [assignedTo, setAssignedTo] = useState("");
  const [when, setWhen] = useState("");
  const [location, setLocation] = useState("");
  const [link, setLink] = useState("");
  const [agenda, setAgenda] = useState("");
  const [notes, setNotes] = useState(defaultNotes ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    start(async () => {
      const r = await arrangeMeeting({
        leadId, assignedTo, mode, scheduledAt: when,
        location: mode === "physical" ? location : null,
        meetingLink: mode === "zoom" ? link : null,
        agenda: agenda || null, conversationNotes: notes || null,
      });
      if (r.error) { setErr(r.error); return; }
      setErr(null); setOpen(false); router.refresh();
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={compact
          ? "inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
          : "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:border-brand-red"}
        title="Assign to Sales Expert / FSR and schedule a meeting"
      >
        <CalendarClock className="w-3.5 h-3.5" /> Meeting
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-black flex items-center gap-2"><CalendarClock className="w-4 h-4 text-brand-red" /> Arrange meeting — {leadName}</h3>
              <button onClick={() => setOpen(false)} className="text-brand-gray-mid hover:text-brand-black"><X className="w-4 h-4" /></button>
            </div>

            {err && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}

            {/* Mode */}
            <div className="flex gap-2">
              {([["physical", "Physical", MapPin], ["zoom", "Zoom", Video], ["phone", "Phone", Phone]] as const).map(([m, label, Icon]) => (
                <button key={m} onClick={() => setMode(m)}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm ${mode === m ? "border-brand-red bg-brand-red/5 text-brand-red font-medium" : "border-border text-brand-gray-mid hover:text-brand-black"}`}>
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            <Field label="Assign to (Sales Expert / FSR) *">
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputCls}>
                <option value="">— select —</option>
                {targets.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {ROLE_LABEL[t.crm_team_role] ?? t.crm_team_role}</option>)}
              </select>
              {targets.length === 0 && <p className="text-[11px] text-amber-700 mt-1">No Sales Experts / FSRs yet — create them in Admin with that sales role.</p>}
            </Field>

            <Field label="Date & time *"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} /></Field>

            {mode === "physical" && <Field label="Location"><input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Shop / city / address" /></Field>}
            {mode === "zoom" && <Field label="Zoom / meeting link"><input value={link} onChange={(e) => setLink(e.target.value)} className={inputCls} placeholder="https://zoom.us/j/…" /></Field>}

            <Field label="Agenda"><input value={agenda} onChange={(e) => setAgenda(e.target.value)} className={inputCls} placeholder="e.g. Product demo + pricing" /></Field>
            <Field label="Conversation so far (what to brief them)"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} /></Field>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
              <button onClick={submit} disabled={pending || !assignedTo || !when} className="px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-medium hover:bg-brand-maroon disabled:opacity-60">
                {pending ? "Scheduling…" : "Assign & schedule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const inputCls = "w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-medium text-brand-gray-mid mb-1 block">{label}</span>{children}</label>;
}
