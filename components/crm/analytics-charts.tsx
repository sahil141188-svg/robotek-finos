"use client";

/**
 * Sales OS analytics dashboard — funnel, conversion, win/loss, leaderboard,
 * lead sources, lead types, activity volume. Recharts + brand palette.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from "recharts";
import { formatIndian } from "@/lib/format";
import { LEAD_TYPE_LABELS } from "@/lib/crm/drip";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/types";
import type { SalesAnalytics } from "@/lib/crm/analytics";
import type { CrmLeadType, CrmActivityType } from "@/types/database";
import {
  TrendingUp, Trophy, GitBranch, Target, Percent, AlertTriangle,
} from "lucide-react";

const RED = "#E52D31", MAROON = "#852321", YELLOW = "#F7DA11", BLACK = "#1F1B20", GRAY = "#9A9596";
const PIE_COLORS = [RED, "#2563eb", "#059669", YELLOW, MAROON, GRAY, "#7c3aed"];

function CardBox({ title, icon, children, className = "" }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-border p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-brand-black flex items-center gap-2 mb-4">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Tip({ active, payload, label, money }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-md p-2.5 text-xs">
      {label && <p className="font-semibold text-brand-black mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-brand-gray-mid">{p.name}: <span className="font-medium text-brand-black">{money ? formatIndian(p.value, 0) : p.value}</span></p>
      ))}
    </div>
  );
}

export function AnalyticsCharts({ data }: { data: SalesAnalytics }) {
  const { kpis } = data;
  const funnelMax = Math.max(...data.funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<Target className="w-5 h-5 text-blue-600" />} label="Total Leads" value={`${kpis.totalLeads}`} />
        <Kpi icon={<GitBranch className="w-5 h-5 text-brand-red" />} label="Open Pipeline" value={formatIndian(kpis.openPipelineValue, 0)} sub={`${kpis.openDeals} deals`} />
        <Kpi icon={<Trophy className="w-5 h-5 text-emerald-600" />} label="Won Value" value={formatIndian(kpis.wonValue, 0)} sub={`${kpis.wonCount} deals`} />
        <Kpi icon={<Percent className="w-5 h-5 text-purple-600" />} label="Win Rate" value={`${kpis.winRate}%`} sub="won / decided" />
        <Kpi icon={<TrendingUp className="w-5 h-5 text-amber-600" />} label="Lead → Won" value={`${kpis.leadToWin}%`} sub="overall conversion" />
      </div>

      {/* ── Funnel + Win/Loss ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox title="Conversion Funnel" icon={<TrendingUp className="w-4 h-4 text-brand-red" />}>
          <div className="space-y-2.5">
            {data.funnel.map((f, i) => {
              const prev = i > 0 ? data.funnel[i - 1].count : null;
              const drop = prev && prev > 0 ? Math.round((f.count / prev) * 100) : null;
              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-brand-black">{f.label}</span>
                    <span className="text-brand-gray-mid">{f.count}{drop !== null && <span className="ml-2 text-[10px]">({drop}%)</span>}</span>
                  </div>
                  <div className="h-6 rounded bg-brand-gray-light overflow-hidden">
                    <div className="h-full rounded" style={{ width: `${Math.max((f.count / funnelMax) * 100, 2)}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardBox>

        <CardBox title="Win / Loss" icon={<Trophy className="w-4 h-4 text-brand-red" />}>
          {data.winLoss.won + data.winLoss.lost === 0 ? (
            <Empty />
          ) : (
            <div className="flex items-center gap-4">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[{ name: "Won", value: data.winLoss.won }, { name: "Lost", value: data.winLoss.lost }]} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={2}>
                      <Cell fill="#059669" /><Cell fill={GRAY} />
                    </Pie>
                    <Tooltip content={<Tip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <Row label="Won" value={`${data.winLoss.won} · ${formatIndian(data.winLoss.wonValue, 0)}`} color="#059669" />
                <Row label="Lost" value={`${data.winLoss.lost} · ${formatIndian(data.winLoss.lostValue, 0)}`} color={GRAY} />
                <Row label="Win rate" value={`${data.winLoss.winRate}%`} color={RED} />
              </div>
            </div>
          )}
        </CardBox>
      </div>

      {/* ── Pipeline by stage ── */}
      <CardBox title="Pipeline Value by Stage" icon={<GitBranch className="w-4 h-4 text-brand-red" />}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.pipelineByStage} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F4F4" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : `${v}`)} />
              <Tooltip content={<Tip money />} cursor={{ fill: "#F5F4F4" }} />
              <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
                {data.pipelineByStage.map((s, i) => <Cell key={i} fill={s.stage === "won" ? "#059669" : s.stage === "lost" ? GRAY : RED} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardBox>

      {/* ── Leaderboard ── */}
      <CardBox title="Sales Rep Leaderboard" icon={<Trophy className="w-4 h-4 text-brand-red" />}>
        {data.leaderboard.length === 0 ? <Empty /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-brand-gray-mid border-b border-border">
                  <th className="py-2 font-medium">Rep</th>
                  <th className="py-2 font-medium text-center">Won</th>
                  <th className="py-2 font-medium text-right">Won Value</th>
                  <th className="py-2 font-medium text-center">Open</th>
                  <th className="py-2 font-medium text-right">Open Value</th>
                  <th className="py-2 font-medium text-center">Win %</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((r, i) => (
                  <tr key={r.ownerId ?? `u${i}`} className="border-b border-border last:border-0">
                    <td className="py-2 font-medium text-brand-black">{i === 0 && r.wonValue > 0 ? "🏆 " : ""}{r.name}</td>
                    <td className="py-2 text-center tabular-nums">{r.wonCount}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{formatIndian(r.wonValue, 0)}</td>
                    <td className="py-2 text-center tabular-nums text-brand-gray-mid">{r.openCount}</td>
                    <td className="py-2 text-right tabular-nums text-brand-gray-mid">{formatIndian(r.openValue, 0)}</td>
                    <td className="py-2 text-center tabular-nums">{r.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBox>

      {/* ── Lead source + Lead type ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox title="Lead Source Performance" icon={<Target className="w-4 h-4 text-brand-red" />}>
          {data.sourcePerf.length === 0 ? <Empty /> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sourcePerf} layout="vertical" margin={{ top: 4, right: 8, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F5F4F4" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="source" tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip content={<Tip />} cursor={{ fill: "#F5F4F4" }} />
                  <Bar dataKey="leads" name="Leads" fill={RED} radius={[0, 4, 4, 0]} />
                  <Bar dataKey="converted" name="Converted" fill="#059669" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBox>

        <CardBox title="Leads by Type" icon={<Target className="w-4 h-4 text-brand-red" />}>
          {data.leadTypeSplit.length === 0 ? <Empty /> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.leadTypeSplit.map((t) => ({ name: LEAD_TYPE_LABELS[t.type as CrmLeadType] ?? t.type, value: t.count }))}
                    dataKey="value" nameKey="name" outerRadius={80} label
                  >
                    {data.leadTypeSplit.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBox>
      </div>

      {/* ── Lost reasons + Activity volume ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CardBox title="Why Deals Are Lost" icon={<AlertTriangle className="w-4 h-4 text-brand-red" />}>
          {data.lostReasons.length === 0 ? <Empty msg="No lost deals yet." /> : (
            <div className="space-y-2">
              {data.lostReasons.map((r) => (
                <div key={r.reason} className="flex items-center justify-between text-sm">
                  <span className="text-brand-black">{r.reason}</span>
                  <span className="text-brand-gray-mid tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardBox>

        <CardBox title="Activity Volume" icon={<TrendingUp className="w-4 h-4 text-brand-red" />}>
          {data.activityByType.length === 0 ? <Empty /> : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.activityByType.map((a) => ({ name: ACTIVITY_TYPE_LABELS[a.type as CrmActivityType] ?? a.type, count: a.count }))} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F5F4F4" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: GRAY }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: GRAY }} axisLine={false} tickLine={false} />
                  <Tooltip content={<Tip />} cursor={{ fill: "#F5F4F4" }} />
                  <Bar dataKey="count" name="Activities" fill={MAROON} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBox>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-brand-gray-mid">{label}</span></div>
      <div className="text-xl font-bold text-brand-black leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-brand-gray-mid mt-0.5">{sub}</div>}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-brand-gray-mid"><span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />{label}</span>
      <span className="font-medium text-brand-black">{value}</span>
    </div>
  );
}

function Empty({ msg = "Not enough data yet." }: { msg?: string }) {
  return <p className="text-sm text-brand-gray-mid py-8 text-center">{msg}</p>;
}
