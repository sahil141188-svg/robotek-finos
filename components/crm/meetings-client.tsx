"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateMeetingStatus } from "@/app/actions/crm-meetings";
import type { MeetingWithContext } from "@/lib/crm/meetings";
import type { CrmMeetingStatus } from "@/types/database";
import { MapPin, Video, Phone, Building2, User, CheckCircle2, X, Clock } from "lucide-react";

const MODE_ICON = { physical: MapPin, zoom: Video, phone: Phone } as const;
const STATUS_COLORS: Record<CrmMeetingStatus, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-gray-200 text-gray-600",
  no_show: "bg-amber-100 text-amber-700",
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function MeetingsClient({ meetings, currentUserId }: { meetings: MeetingWithContext[]; currentUserId: string }) {
  const router = useRouter();
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [pending, start] = useTransition();

  const shown = meetings.filter((m) => scope === "all" || m.assigned_to === currentUserId);
  const upcoming = shown.filter((m) => m.status === "scheduled");
  const past = shown.filter((m) => m.status !== "scheduled");

  function setStatus(id: string, status: CrmMeetingStatus) {
    let outcome: string | undefined;
    if (status === "done") outcome = window.prompt("Outcome / notes from the meeting?") ?? undefined;
    start(async () => { await updateMeetingStatus(id, status, outcome); router.refresh(); });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-white p-0.5 w-fit">
        {(["all", "mine"] as const).map((s) => (
          <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-md text-xs font-medium ${scope === s ? "bg-brand-red text-white" : "text-brand-gray-mid hover:text-brand-black"}`}>
            {s === "all" ? "All meetings" : "Assigned to me"}
          </button>
        ))}
      </div>

      <Section title={`Upcoming (${upcoming.length})`} items={upcoming} pending={pending} onStatus={setStatus} />
      {past.length > 0 && <Section title={`Past (${past.length})`} items={past} pending={pending} onStatus={setStatus} dim />}
      {shown.length === 0 && <div className="rounded-xl border border-border bg-white p-8 text-center text-sm text-brand-gray-mid">No meetings scheduled.</div>}
    </div>
  );
}

function Section({ title, items, pending, onStatus, dim }: {
  title: string; items: MeetingWithContext[]; pending: boolean; onStatus: (id: string, s: CrmMeetingStatus) => void; dim?: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
      {items.map((m) => {
        const Icon = MODE_ICON[m.mode];
        return (
          <div key={m.id} className={`rounded-xl border border-border bg-white p-4 ${dim ? "opacity-75" : ""}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-brand-black">{m.lead_name ?? "Lead"}</span>
                  {m.lead_company && <span className="text-xs text-brand-gray-mid flex items-center gap-1"><Building2 className="w-3 h-3" />{m.lead_company}</span>}
                  <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[m.status]}`}>{m.status.replace("_", " ")}</span>
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-brand-gray-mid flex-wrap">
                  <span className="inline-flex items-center gap-1 text-brand-black"><Icon className="w-3.5 h-3.5 text-brand-red" />{m.mode}</span>
                  <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(m.scheduled_at)}</span>
                  {m.lead_phone && <a href={`tel:${m.lead_phone}`} className="inline-flex items-center gap-1 hover:text-brand-red"><Phone className="w-3 h-3" />{m.lead_phone}</a>}
                  {m.assignee_name && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{m.assignee_name}</span>}
                </div>
                {(m.location || m.meeting_link) && (
                  <div className="mt-1 text-xs">
                    {m.location && <span className="text-brand-gray-mid">📍 {m.location}</span>}
                    {m.meeting_link && <a href={m.meeting_link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{m.meeting_link}</a>}
                  </div>
                )}
                {m.lead_enquiry_type && <div className="mt-1 text-[11px] text-brand-gray-mid">Type: {m.lead_enquiry_type}{m.lead_product ? ` · Interested: ${m.lead_product}` : ""}</div>}
                {m.agenda && <div className="mt-1.5 text-xs"><span className="text-brand-gray-mid">Agenda:</span> {m.agenda}</div>}
                {m.conversation_notes && <div className="mt-1 text-xs text-brand-gray-mid bg-brand-gray-light/50 rounded p-2">💬 {m.conversation_notes}</div>}
                {m.outcome && <div className="mt-1 text-xs text-emerald-700">✓ Outcome: {m.outcome}</div>}
                {m.lead_id && <Link href={`/dashboard/sales-os/leads`} className="mt-1 inline-block text-[11px] text-brand-red hover:underline">View in leads →</Link>}
              </div>
              {m.status === "scheduled" && (
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => onStatus(m.id, "done")} disabled={pending} className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline"><CheckCircle2 className="w-3.5 h-3.5" />Done</button>
                  <button onClick={() => onStatus(m.id, "no_show")} disabled={pending} className="text-xs text-amber-700 hover:underline">No-show</button>
                  <button onClick={() => onStatus(m.id, "cancelled")} disabled={pending} className="inline-flex items-center gap-1 text-xs text-brand-gray-mid hover:text-brand-black"><X className="w-3 h-3" />Cancel</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
