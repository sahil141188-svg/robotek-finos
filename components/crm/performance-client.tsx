"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setWeeklyTarget } from "@/app/actions/crm";
import { TEAM_ROLE_LABELS, DEPARTMENT_SHORT } from "@/lib/crm/types";
import { formatIndian } from "@/lib/format";
import type { Performance } from "@/lib/crm/performance";
import type { CrmTeamRole, CrmDepartment } from "@/types/database";
import { ChevronLeft, ChevronRight, ListChecks, CalendarClock, Trophy, IndianRupee, Check } from "lucide-react";

function pct(a: number, t: number): number { return t > 0 ? Math.round((a / t) * 100) : a > 0 ? 100 : 0; }
function barColor(p: number): string { return p >= 100 ? "bg-emerald-500" : p >= 60 ? "bg-amber-500" : "bg-red-400"; }

type Edit = { followups: number; meetings: number; conversions: number; value: number };

export function PerformanceClient({
  data, canManage, weekLabel, prevWeek, nextWeek, thisWeek, isThisWeek,
}: {
  data: Performance; canManage: boolean; weekLabel: string;
  prevWeek: string; nextWeek: string; thisWeek: string; isThisWeek: boolean;
}) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(data.users.map((u) => [u.userId, { ...u.targets }]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function go(week: string) { router.push(`/dashboard/sales-os/performance?week=${week}`); }
  function setField(id: string, k: keyof Edit, v: number) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], [k]: v } }));
  }
  function save(id: string) {
    setSavingId(id);
    start(async () => {
      await setWeeklyTarget(id, data.weekStart, edits[id]);
      setSavingId(null);
      router.refresh();
    });
  }

  const c = data.company;

  return (
    <div className="space-y-5">
      {/* Week nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => go(prevWeek)} className="p-2 rounded-lg border border-border hover:bg-brand-gray-light"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => go(thisWeek)} className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-brand-gray-light">This week</button>
          <button onClick={() => go(nextWeek)} className="p-2 rounded-lg border border-border hover:bg-brand-gray-light"><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="text-sm font-medium text-brand-black">{weekLabel}{isThisWeek && <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5">current</span>}</div>
      </div>

      {/* Company KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CompanyTile icon={<ListChecks className="w-5 h-5 text-blue-600" />} label="Follow-ups" actual={c.actuals.followups} target={c.targets.followups} />
        <CompanyTile icon={<CalendarClock className="w-5 h-5 text-indigo-600" />} label="Meetings done" actual={c.actuals.meetings} target={c.targets.meetings} />
        <CompanyTile icon={<Trophy className="w-5 h-5 text-emerald-600" />} label="Conversions" actual={c.actuals.conversions} target={c.targets.conversions} />
        <CompanyTile icon={<IndianRupee className="w-5 h-5 text-brand-red" />} label="Value won" actual={c.actuals.value} target={c.targets.value} money />
      </div>
      <p className="text-xs text-brand-gray-mid">{c.salesPeople} sales team members · {c.actuals.openLeads} open leads in their hands</p>

      {/* Per-user table */}
      <div className="bg-white rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-brand-gray-light/50 text-left text-xs text-brand-gray-mid">
              <th className="px-3 py-3 font-medium">Team member</th>
              <th className="px-3 py-3 font-medium">Follow-ups</th>
              <th className="px-3 py-3 font-medium">Meetings</th>
              <th className="px-3 py-3 font-medium">Conversions</th>
              <th className="px-3 py-3 font-medium">Value won</th>
              {canManage && <th className="px-3 py-3 font-medium text-right">Targets</th>}
            </tr>
          </thead>
          <tbody>
            {data.users.length === 0 && (
              <tr><td colSpan={canManage ? 6 : 5} className="px-3 py-10 text-center text-brand-gray-mid">No sales-team users yet. Create them in Admin with an NBD/CRR role.</td></tr>
            )}
            {data.users.map((u) => {
              const e = edits[u.userId];
              const dirty = e && (e.followups !== u.targets.followups || e.meetings !== u.targets.meetings || e.conversions !== u.targets.conversions || e.value !== u.targets.value);
              return (
                <tr key={u.userId} className="border-b border-border last:border-0 align-top">
                  <td className="px-3 py-3">
                    <div className="font-medium text-brand-black">{u.name}</div>
                    <div className="text-[10px] text-brand-gray-mid">
                      {u.department && <span className="bg-brand-gray-light rounded px-1 py-0.5 mr-1">{DEPARTMENT_SHORT[u.department as CrmDepartment]}</span>}
                      {u.teamRole ? TEAM_ROLE_LABELS[u.teamRole as CrmTeamRole] : ""}
                    </div>
                  </td>
                  <MetricCell actual={u.actuals.followups} target={u.targets.followups} />
                  <MetricCell actual={u.actuals.meetings} target={u.targets.meetings} />
                  <MetricCell actual={u.actuals.conversions} target={u.targets.conversions} />
                  <MetricCell actual={u.actuals.value} target={u.targets.value} money />
                  {canManage && (
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <TInput label="F" value={e?.followups ?? 0} onChange={(v) => setField(u.userId, "followups", v)} />
                        <TInput label="M" value={e?.meetings ?? 0} onChange={(v) => setField(u.userId, "meetings", v)} />
                        <TInput label="C" value={e?.conversions ?? 0} onChange={(v) => setField(u.userId, "conversions", v)} />
                        <TInput label="₹" value={e?.value ?? 0} onChange={(v) => setField(u.userId, "value", v)} wide />
                        <button onClick={() => save(u.userId)} disabled={!dirty || pending}
                          className="px-2 py-1 rounded bg-brand-red text-white text-xs disabled:opacity-40 inline-flex items-center gap-1">
                          {savingId === u.userId ? "…" : <Check className="w-3 h-3" />}Save
                        </button>
                      </div>
                      <p className="text-[10px] text-brand-gray-mid text-right mt-1">F=follow-ups · M=meetings · C=conversions · ₹=value</p>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompanyTile({ icon, label, actual, target, money }: { icon: React.ReactNode; label: string; actual: number; target: number; money?: boolean }) {
  const p = pct(actual, target);
  const fmt = (n: number) => money ? formatIndian(n, 0) : `${n}`;
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs font-medium text-brand-gray-mid">{label}</span></div>
      <div className="text-xl font-bold text-brand-black">{fmt(actual)}<span className="text-xs font-normal text-brand-gray-mid"> / {fmt(target)}</span></div>
      <div className="mt-2 h-1.5 rounded bg-brand-gray-light overflow-hidden"><div className={`h-full ${barColor(p)}`} style={{ width: `${Math.min(p, 100)}%` }} /></div>
      <div className="text-[11px] text-brand-gray-mid mt-1">{p}% of target</div>
    </div>
  );
}

function MetricCell({ actual, target, money }: { actual: number; target: number; money?: boolean }) {
  const p = pct(actual, target);
  const fmt = (n: number) => money ? formatIndian(n, 0) : `${n}`;
  return (
    <td className="px-3 py-3">
      <div className="text-brand-black font-medium">{fmt(actual)}<span className="text-xs text-brand-gray-mid"> / {fmt(target)}</span></div>
      <div className="mt-1 h-1.5 w-24 rounded bg-brand-gray-light overflow-hidden"><div className={`h-full ${barColor(p)}`} style={{ width: `${Math.min(p, 100)}%` }} /></div>
    </td>
  );
}

function TInput({ label, value, onChange, wide }: { label: string; value: number; onChange: (v: number) => void; wide?: boolean }) {
  return (
    <label className="inline-flex items-center gap-0.5">
      <span className="text-[10px] text-brand-gray-mid">{label}</span>
      <input type="number" min="0" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className={`${wide ? "w-20" : "w-12"} rounded border border-border px-1.5 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-brand-red/40`} />
    </label>
  );
}
