"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setDealStage, setPriority } from "@/app/actions/crm-chatter";
import { DEAL_STAGES, DEAL_STAGE_LABELS, DEPARTMENT_SHORT, ACTIVITY_TYPE_LABELS, MAX_FOLLOWUPS } from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { DealDetail } from "@/lib/crm/detail";
import type { Database } from "@/types/database";
import type { CrmDealStage } from "@/types/database";
import { Chatter } from "./chatter";
import { Trophy, XCircle, Building2, Calendar, User, Tag, Phone } from "lucide-react";

type LostReason = Database["public"]["Tables"]["crm_lost_reasons"]["Row"];

const PRIORITIES = ["COLD", "MEDIUM", "HOT"];
const PRIORITY_COLORS: Record<string, string> = {
  HOT: "bg-red-100 text-red-700", MEDIUM: "bg-amber-100 text-amber-700", COLD: "bg-blue-100 text-blue-700",
};
const OPEN_STAGES: CrmDealStage[] = ["assigned", "follow_up"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function DealDetailView({ detail, lostReasons }: { detail: DealDetail; lostReasons: LostReason[] }) {
  const router = useRouter();
  const { deal, activities, messages } = detail;
  const [pending, start] = useTransition();
  const [lostOpen, setLostOpen] = useState(false);
  const [lostId, setLostId] = useState("");

  function move(stage: CrmDealStage, lr?: string | null) {
    start(async () => { await setDealStage(deal.id, stage, lr); setLostOpen(false); router.refresh(); });
  }
  function changePriority(p: string) {
    start(async () => { await setPriority("deal", deal.id, p); router.refresh(); });
  }

  const isWon = deal.stage === "won";
  const isLost = deal.stage === "lost";
  const followupCount = (deal as { followup_count?: number }).followup_count ?? 0;
  const followupPct = Math.min((followupCount / MAX_FOLLOWUPS) * 100, 100);
  const followupWarn = followupCount >= 25;
  const followupMaxed = followupCount >= MAX_FOLLOWUPS;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="bg-white rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {OPEN_STAGES.map((s) => {
              const active = deal.stage === s;
              const passed = OPEN_STAGES.indexOf(deal.stage as CrmDealStage) > OPEN_STAGES.indexOf(s);
              return (
                <button key={s} onClick={() => move(s)} disabled={pending}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${active ? "bg-brand-red text-white" : passed ? "bg-emerald-50 text-emerald-700" : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>
                  {DEAL_STAGE_LABELS[s]}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => move("won")} disabled={pending || isWon}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isWon ? "bg-emerald-600 text-white" : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50"} disabled:opacity-60`}>
              <Trophy className="w-3.5 h-3.5" /> Order Received (Won)
            </button>
            <button onClick={() => setLostOpen((v) => !v)} disabled={pending}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${isLost ? "bg-gray-600 text-white" : "border border-border text-brand-gray-mid hover:bg-brand-gray-light"}`}>
              <XCircle className="w-3.5 h-3.5" /> Lead Closed (Lost)
            </button>
          </div>
        </div>
        {lostOpen && (
          <div className="mt-3 flex items-end gap-2 rounded-lg bg-brand-gray-light/50 p-3">
            <label className="block flex-1 max-w-xs">
              <span className="text-[11px] font-medium text-brand-gray-mid mb-1 block">Lost reason</span>
              <select value={lostId} onChange={(e) => setLostId(e.target.value)} className="w-full rounded-lg border border-border px-3 py-2 text-sm">
                <option value="">— select —</option>
                {lostReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <button onClick={() => move("lost", lostId || null)} disabled={pending}
              className="px-3 py-2 bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-800 disabled:opacity-60">Confirm Lost</button>
            <button onClick={() => setLostOpen(false)} className="px-3 py-2 text-xs text-brand-gray-mid">Cancel</button>
          </div>
        )}
      </div>

      {/* Follow-up counter (30-cap tracker) */}
      {!isWon && !isLost && (
        <div className={`rounded-xl border p-4 ${followupMaxed ? "border-red-300 bg-red-50" : followupWarn ? "border-amber-300 bg-amber-50" : "border-border bg-white"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-brand-black">
              <Phone className="w-4 h-4" /> Follow-up Tracker
            </span>
            <span className={`text-sm font-bold tabular-nums ${followupMaxed ? "text-red-700" : followupWarn ? "text-amber-700" : "text-brand-black"}`}>
              {followupCount} / {MAX_FOLLOWUPS}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${followupMaxed ? "bg-red-500" : followupWarn ? "bg-amber-400" : "bg-emerald-500"}`}
              style={{ width: `${followupPct}%` }}
            />
          </div>
          {followupMaxed && (
            <p className="mt-2 text-xs text-red-700 font-medium">30 follow-ups reached — mark as Won or Lost per the sales funnel.</p>
          )}
          {followupWarn && !followupMaxed && (
            <p className="mt-2 text-xs text-amber-700">Approaching 30-follow-up limit. Close or escalate soon.</p>
          )}
          {!followupWarn && (
            <p className="mt-2 text-xs text-brand-gray-mid">Each call or WhatsApp logged counts toward the 30-follow-up limit.</p>
          )}
        </div>
      )}

      {/* Header + fields */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-brand-black">{deal.title}</h2>
            <div className="text-2xl font-bold text-brand-red mt-1">{formatIndian(Number(deal.value) || 0, 0)}</div>
          </div>
          {/* Priority */}
          <div className="flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-brand-gray-mid" />
            {PRIORITIES.map((p) => (
              <button key={p} onClick={() => changePriority(p)} disabled={pending}
                className={`text-[11px] rounded-full px-2 py-0.5 font-medium transition-colors ${deal.priority === p ? PRIORITY_COLORS[p] : "bg-brand-gray-light text-brand-gray-mid hover:text-brand-black"}`}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Account"
            value={deal.account_id ? <Link href={`/dashboard/sales-os/accounts/${deal.account_id}`} className="text-brand-red hover:underline">{deal.account_name ?? "—"}</Link> : "—"} />
          <Field icon={<User className="w-3.5 h-3.5" />} label="Owner" value={deal.owner_name ?? "—"} />
          <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Expected close" value={fmtDate(deal.expected_close)} />
          <Field label="Department" value={DEPARTMENT_SHORT[deal.department]} />
          <Field label="Probability" value={`${deal.probability ?? 0}%`} />
          <Field label="Source" value={deal.source ?? "—"} />
        </div>
        {isLost && deal.lost_reason_name && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 rounded px-3 py-1.5 inline-block">Lost: {deal.lost_reason_name}</div>
        )}
        {deal.notes && <p className="mt-3 text-sm text-brand-gray-mid whitespace-pre-wrap">{deal.notes}</p>}
      </div>

      {/* Activities */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-brand-black mb-3">Activities</h3>
        {activities.length === 0 ? <p className="text-sm text-brand-gray-mid">No activities.</p> : (
          <div className="divide-y divide-border">
            {activities.map((a) => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <span className={a.done ? "line-through text-brand-gray-mid" : "text-brand-black"}>
                  <span className="text-[10px] uppercase bg-brand-gray-light rounded px-1.5 py-0.5 mr-2 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[a.type]}</span>
                  {a.subject}
                </span>
                <span className="text-xs text-brand-gray-mid">{a.due_at ? fmtDate(a.due_at) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Chatter parentType="deal" parentId={deal.id} messages={messages} />
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-brand-gray-mid flex items-center gap-1">{icon}{label}</div>
      <div className="text-brand-black mt-0.5">{value}</div>
    </div>
  );
}
