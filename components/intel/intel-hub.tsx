"use client";

/**
 * IntelHub — the full AI Intelligence Hub UI.
 * Renders all 15 AI insights in one scrollable dashboard.
 */

import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import type { IntelligenceReport } from "@/app/actions/ai-insights";
import {
  AlertTriangle, Copy, ShieldAlert, TrendingUp, TrendingDown,
  CheckCircle2, Zap, Brain, Activity, BarChart3, Users,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
  ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ── Number formatter ──────────────────────────────────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000)    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  if (abs >= 1_000)       return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

// ── Health score circular gauge ───────────────────────────────────────────────

function HealthGauge({ score, grade }: { score: number; grade: string }) {
  const radius   = 52;
  const circ     = 2 * Math.PI * radius;
  const progress = (score / 100) * circ;
  const color    = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#f1f0f0" strokeWidth="12" />
        <circle
          cx="60" cy="60" r={radius} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${progress} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-brand-black">{score}</span>
        <span className="text-xs font-bold text-brand-gray-mid uppercase tracking-wider">Grade {grade}</span>
      </div>
    </div>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────

function RiskBadge({ risk }: { risk: "high" | "medium" | "low" }) {
  return (
    <Badge className={cn(
      "text-[10px] font-bold border uppercase px-2 py-0.5",
      risk === "high"   && "!bg-red-100 !text-red-700 !border-red-200",
      risk === "medium" && "!bg-yellow-100 !text-yellow-700 !border-yellow-200",
      risk === "low"    && "!bg-blue-100 !text-blue-700 !border-blue-200",
    )}>
      {risk}
    </Badge>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, count, color = "text-brand-red" }: {
  icon: React.ElementType; title: string; count?: number; color?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <Icon className={cn("w-4 h-4 shrink-0", color)} />
      <h2 className="font-semibold text-sm text-brand-black">{title}</h2>
      {count !== undefined && (
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          count > 0 ? "bg-brand-red/10 text-brand-red" : "bg-green-50 text-green-700",
        )}>
          {count === 0 ? "All clear" : count}
        </span>
      )}
    </div>
  );
}

// ── Briefing hook (streaming) ─────────────────────────────────────────────────

function useBriefing(report: IntelligenceReport) {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  async function generate() {
    setText(""); setDone(false); setLoading(true);
    try {
      const res = await fetch("/api/ai/briefing", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ report }),
      });

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();

      while (true) {
        const { done: d, value } = await reader.read();
        if (d) break;
        const chunk = decoder.decode(value, { stream: true });
        setText((prev) => prev + chunk);
      }
    } finally {
      setLoading(false);
      setDone(true);
    }
  }

  return { text, loading, done, generate };
}

// ── Main component ────────────────────────────────────────────────────────────

export function IntelHub({ report }: { report: IntelligenceReport }) {
  const {
    healthScore, anomalies, duplicates, fraudSignals, gstIssues,
    cashflowForecast, vendorRisk, whatChanged, summary,
  } = report;

  const briefing = useBriefing(report);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Auto-generate briefing on mount
  useEffect(() => { briefing.generate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(section: string) {
    setExpandedSection((s) => s === section ? null : section);
  }

  // Cashflow chart colors
  const INFLOW_COLOR  = "#22c55e";
  const OUTFLOW_COLOR = "#ef4444";
  const PROJ_OPACITY  = 0.4;

  return (
    <div className="space-y-5 max-w-7xl">

      {/* ── Row 1: Health Score + Briefing ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Health Score */}
        <div className="bg-white rounded-2xl border border-border p-6 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 self-start">
            <Activity className="w-4 h-4 text-brand-red" />
            <span className="text-sm font-semibold text-brand-black">Daily Health Score</span>
          </div>

          <HealthGauge score={healthScore.total} grade={healthScore.grade} />

          <div className="w-full grid grid-cols-2 gap-2 text-center">
            {[
              { label: "Cash",       val: healthScore.cashHealth,  max: 25 },
              { label: "AR",         val: healthScore.arHealth,    max: 25 },
              { label: "AP",         val: healthScore.apHealth,    max: 25 },
              { label: "Compliance", val: healthScore.complianceH, max: 25 },
            ].map(({ label, val, max }) => (
              <div key={label} className="bg-brand-gray-light rounded-xl p-2.5">
                <p className="text-[10px] text-brand-gray-mid">{label}</p>
                <p className="text-sm font-bold text-brand-black">{val}<span className="text-[10px] font-normal text-brand-gray-mid">/{max}</span></p>
              </div>
            ))}
          </div>

          <p className="text-xs text-brand-gray-mid text-center">{healthScore.summary}</p>
        </div>

        {/* CFO Morning Briefing */}
        <div className="lg:col-span-2 bg-gradient-to-br from-brand-black to-[#2d2730] rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-yellow" />
              <span className="text-sm font-semibold text-white">CFO Morning Briefing</span>
              <span className="text-[10px] text-white/40 ml-1">
                {process.env.NEXT_PUBLIC_HAS_AI === "1" ? "Claude AI" : "AI Generated"}
              </span>
            </div>
            <button
              onClick={briefing.generate}
              disabled={briefing.loading}
              className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
              title="Regenerate"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", briefing.loading && "animate-spin")} />
            </button>
          </div>

          <div className="flex-1 min-h-36 text-sm text-white/85 leading-relaxed whitespace-pre-line font-light overflow-auto max-h-56">
            {briefing.loading && !briefing.text && (
              <div className="flex items-center gap-2 text-white/40">
                <Sparkles className="w-4 h-4 animate-pulse" />
                <span>Generating your briefing…</span>
              </div>
            )}
            {briefing.text}
            {briefing.loading && <span className="animate-pulse text-brand-yellow">▌</span>}
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
            <span className="text-[11px] bg-white/10 text-white/70 rounded-full px-2.5 py-1">
              {summary.totalTxns} transactions
            </span>
            <span className="text-[11px] bg-green-500/20 text-green-300 rounded-full px-2.5 py-1">
              ↑ {fmt(summary.totalInflow)} inflow
            </span>
            <span className="text-[11px] bg-red-500/20 text-red-300 rounded-full px-2.5 py-1">
              ↓ {fmt(summary.totalOutflow)} outflow
            </span>
            <span className={cn(
              "text-[11px] rounded-full px-2.5 py-1",
              summary.netCashflow >= 0 ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300",
            )}>
              Net {fmt(summary.netCashflow)}
            </span>
            {summary.alertCount > 0 && (
              <span className="text-[11px] bg-yellow-500/20 text-yellow-300 rounded-full px-2.5 py-1">
                ⚠ {summary.alertCount} alert{summary.alertCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: What Changed Today ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <SectionHeader icon={Activity} title="What Changed Today" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {whatChanged.map((item) => {
            const Icon = item.direction === "up" ? ArrowUpRight : item.direction === "down" ? ArrowDownRight : Minus;
            return (
              <div key={item.metric} className="bg-brand-gray-light rounded-xl p-3 text-center">
                <p className="text-[10px] text-brand-gray-mid truncate">{item.metric}</p>
                <p className="text-base font-bold text-brand-black mt-0.5">
                  {item.metric.includes("Transaction") ? item.current : fmt(item.current)}
                </p>
                <div className={cn(
                  "inline-flex items-center gap-1 text-[10px] font-semibold mt-1",
                  item.sentiment === "good"    && "text-green-600",
                  item.sentiment === "bad"     && "text-red-600",
                  item.sentiment === "neutral" && "text-brand-gray-mid",
                )}>
                  <Icon className="w-3 h-3" />
                  {item.direction === "flat"
                    ? "No change"
                    : `${item.direction === "up" ? "+" : ""}${item.metric.includes("Transaction") ? item.delta : fmt(item.delta)} vs yesterday`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Row 3: Alert cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          {
            key:   "anomalies",
            icon:  AlertTriangle,
            title: "Anomalies",
            count: anomalies.length,
            color: "text-orange-500",
            bg:    "bg-orange-50",
            desc:  anomalies.length === 0
              ? "No unusual transactions"
              : `${anomalies.filter((a) => a.severity === "high").length} high · ${anomalies.filter((a) => a.severity === "medium").length} medium`,
          },
          {
            key:   "duplicates",
            icon:  Copy,
            title: "Duplicate Payments",
            count: duplicates.length,
            color: "text-blue-600",
            bg:    "bg-blue-50",
            desc:  duplicates.length === 0
              ? "No duplicates detected"
              : `Potential savings: ${fmt(duplicates.reduce((s, d) => s + d.amount, 0))}`,
          },
          {
            key:   "fraud",
            icon:  ShieldAlert,
            title: "Fraud Signals",
            count: fraudSignals.filter((f) => f.risk !== "low").length,
            color: "text-red-600",
            bg:    "bg-red-50",
            desc:  fraudSignals.length === 0
              ? "No suspicious patterns"
              : `${fraudSignals.filter((f) => f.risk === "high").length} high · ${fraudSignals.filter((f) => f.risk === "medium").length} medium`,
          },
          {
            key:   "gst",
            icon:  Zap,
            title: "GST Mismatches",
            count: gstIssues.length,
            color: "text-purple-600",
            bg:    "bg-purple-50",
            desc:  gstIssues.length === 0
              ? "All GST entries valid"
              : `${gstIssues.length} mismatch${gstIssues.length > 1 ? "es" : ""} — review before filing`,
          },
        ].map((card) => (
          <button
            key={card.key}
            onClick={() => toggle(card.key)}
            className="bg-white rounded-2xl border border-border p-5 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                <card.icon className={cn("w-5 h-5", card.color)} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  "text-xl font-black",
                  card.count === 0 ? "text-green-600" : "text-brand-black",
                )}>
                  {card.count}
                </span>
                {expandedSection === card.key
                  ? <ChevronUp className="w-3.5 h-3.5 text-brand-gray-mid" />
                  : <ChevronDown className="w-3.5 h-3.5 text-brand-gray-mid" />
                }
              </div>
            </div>
            <p className="text-sm font-semibold text-brand-black">{card.title}</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">{card.desc}</p>
          </button>
        ))}
      </div>

      {/* ── Expanded detail panels ────────────────────────────────────────── */}

      {/* Anomalies */}
      {expandedSection === "anomalies" && anomalies.length > 0 && (
        <DetailPanel title="Transaction Anomalies" onClose={() => toggle("anomalies")}>
          <div className="divide-y divide-border">
            {anomalies.map((a) => (
              <div key={a.id} className="py-3 flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  a.severity === "high" ? "bg-red-50" : "bg-orange-50",
                )}>
                  <AlertTriangle className={cn("w-4 h-4", a.severity === "high" ? "text-red-600" : "text-orange-500")} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-brand-black truncate">{a.ledger}</span>
                    <RiskBadge risk={a.severity === "high" ? "high" : "medium"} />
                    <span className="text-xs text-brand-gray-mid">{a.category}</span>
                  </div>
                  <p className="text-xs text-brand-gray-mid mt-0.5">{a.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-brand-black">{fmt(a.amount)}</p>
                  <p className="text-[10px] text-brand-gray-mid">{a.date}</p>
                </div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {/* Duplicate Payments */}
      {expandedSection === "duplicates" && duplicates.length > 0 && (
        <DetailPanel title="Potential Duplicate Payments" onClose={() => toggle("duplicates")}>
          <div className="divide-y divide-border">
            {duplicates.map((d, i) => (
              <div key={i} className="py-3 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Copy className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-brand-black">{d.ledger}</p>
                  <p className="text-xs text-brand-gray-mid mt-0.5">{d.reason}</p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-brand-gray-mid">Entry 1: {d.date1}</span>
                    <span className="text-[10px] text-brand-gray-mid">Entry 2: {d.date2}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-brand-black">{fmt(d.amount)}</p>
                  <p className="text-[10px] text-blue-600 font-medium">Verify!</p>
                </div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {/* Fraud Signals */}
      {expandedSection === "fraud" && fraudSignals.length > 0 && (
        <DetailPanel title="Fraud Detection Signals" onClose={() => toggle("fraud")}>
          <div className="divide-y divide-border">
            {fraudSignals.map((f) => (
              <div key={f.id} className="py-3 flex items-start gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  f.risk === "high" ? "bg-red-50" : f.risk === "medium" ? "bg-yellow-50" : "bg-gray-50",
                )}>
                  <ShieldAlert className={cn("w-4 h-4",
                    f.risk === "high" ? "text-red-600" : f.risk === "medium" ? "text-yellow-600" : "text-gray-500",
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-brand-black">{f.ledger}</span>
                    <RiskBadge risk={f.risk} />
                  </div>
                  <p className="text-xs font-medium text-brand-black mt-0.5">{f.signal}</p>
                  <p className="text-xs text-brand-gray-mid">{f.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-brand-black">{fmt(f.amount)}</p>
                  <p className="text-[10px] text-brand-gray-mid">{f.date}</p>
                </div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {/* GST Mismatches */}
      {expandedSection === "gst" && gstIssues.length > 0 && (
        <DetailPanel title="GST Mismatch Alerts" onClose={() => toggle("gst")}>
          <div className="divide-y divide-border">
            {gstIssues.map((g, i) => (
              <div key={i} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-brand-black">{g.ledger}</p>
                    <p className="text-xs text-brand-gray-mid mt-0.5">{g.issue}</p>
                    <div className="flex gap-4 mt-1.5">
                      <span className="text-[10px]"><span className="text-brand-gray-mid">Base:</span> <strong>{fmt(g.baseAmount)}</strong></span>
                      <span className="text-[10px]"><span className="text-brand-gray-mid">Tax paid:</span> <strong className="text-red-600">{fmt(g.taxAmount)}</strong></span>
                      <span className="text-[10px]"><span className="text-brand-gray-mid">Expected:</span> <strong className="text-green-600">{fmt(g.expectedTax)}</strong></span>
                    </div>
                  </div>
                  <span className="text-[10px] text-brand-gray-mid shrink-0">{g.date}</span>
                </div>
              </div>
            ))}
          </div>
        </DetailPanel>
      )}

      {/* ── Row 4: Cashflow Forecast ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <SectionHeader icon={TrendingUp} title="Cashflow Forecast" color="text-green-600" />
        <div className="text-xs text-brand-gray-mid mb-4">
          Historical data + 3-month AI projection based on trend analysis
        </div>
        {cashflowForecast.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cashflowForecast} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => fmt(v)} tick={{ fontSize: 10 }} width={64} />
              <Tooltip
                formatter={(v) => [fmt(Number(v)), ""]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e2e0e0" }}
              />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="inflow" name="Inflow" fill={INFLOW_COLOR} radius={[3, 3, 0, 0]}>
                {cashflowForecast.map((p, i) => (
                  <Cell key={i} fill={INFLOW_COLOR} opacity={p.projected ? PROJ_OPACITY : 1} />
                ))}
              </Bar>
              <Bar dataKey="outflow" name="Outflow" fill={OUTFLOW_COLOR} radius={[3, 3, 0, 0]}>
                {cashflowForecast.map((p, i) => (
                  <Cell key={i} fill={OUTFLOW_COLOR} opacity={p.projected ? PROJ_OPACITY : 1} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState text="Upload bank statements to see cashflow forecast" />
        )}
        <p className="text-[10px] text-brand-gray-mid mt-2">
          Faded bars = projected months. Projection uses linear regression on historical trend.
        </p>
      </div>

      {/* ── Row 5: Vendor Risk + Anomaly chart ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Vendor Risk Ranking */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <SectionHeader icon={Users} title="Vendor Risk Scoring" color="text-blue-600" />
          {vendorRisk.length === 0 ? (
            <EmptyState text="No vendor risk data available" />
          ) : (
            <div className="space-y-2.5">
              {vendorRisk.slice(0, 8).map((v) => (
                <div key={v.name} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-brand-black truncate">{v.name}</p>
                      <RiskBadge risk={v.riskLevel} />
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-brand-gray-light rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            v.riskLevel === "high"   && "bg-red-500",
                            v.riskLevel === "medium" && "bg-yellow-400",
                            v.riskLevel === "low"    && "bg-green-500",
                          )}
                          style={{ width: `${v.riskScore}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-brand-gray-mid shrink-0">
                        {v.riskScore}/100
                      </span>
                    </div>
                    {v.flags[0] && (
                      <p className="text-[10px] text-brand-gray-mid mt-0.5 truncate">{v.flags[0]}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-brand-black">{fmt(v.totalSpend)}</p>
                    <p className="text-[10px] text-brand-gray-mid">{v.concentration}% of AP</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Anomaly distribution chart */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <SectionHeader icon={BarChart3} title="Anomaly Distribution by Category" color="text-orange-500" />
          {anomalies.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-52 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-brand-black">No anomalies detected</p>
              <p className="text-xs text-brand-gray-mid">All transactions within normal parameters</p>
            </div>
          ) : (
            (() => {
              const byCategory = anomalies.reduce<Record<string, { high: number; medium: number }>>((acc, a) => {
                if (!acc[a.category]) acc[a.category] = { high: 0, medium: 0 };
                acc[a.category][a.severity]++;
                return acc;
              }, {});
              const chartData = Object.entries(byCategory).map(([name, v]) => ({ name, ...v }));
              return (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Bar dataKey="high"   name="High"   fill="#ef4444" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="medium" name="Medium" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              );
            })()
          )}
        </div>
      </div>

      {/* ── Row 6: AI Receivable follow-up ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-border p-5">
        <SectionHeader icon={Brain} title="AI Receivable Follow-up Suggestions" color="text-indigo-600" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              bucket:  "0–30 days",
              action:  "Gentle reminder",
              message: "Dear {Customer}, this is a friendly reminder that Invoice #{INV} for {Amount} falls due on {Date}. Please arrange payment at your earliest convenience.",
              color:   "border-green-200 bg-green-50",
              badge:   "text-green-700 bg-green-100",
            },
            {
              bucket:  "31–60 days",
              action:  "Firm follow-up",
              message: "Dear {Customer}, Invoice #{INV} for {Amount} is now 30+ days overdue. Kindly settle this at the earliest to maintain your credit terms with us.",
              color:   "border-yellow-200 bg-yellow-50",
              badge:   "text-yellow-700 bg-yellow-100",
            },
            {
              bucket:  "60+ days",
              action:  "Escalation notice",
              message: "Dear {Customer}, Invoice #{INV} for {Amount} is critically overdue. We request immediate payment or a payment plan within 48 hours to avoid legal action.",
              color:   "border-red-200 bg-red-50",
              badge:   "text-red-700 bg-red-100",
            },
          ].map((t) => (
            <div key={t.bucket} className={cn("rounded-xl border p-4 space-y-2", t.color)}>
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", t.badge)}>
                  {t.bucket}
                </span>
                <span className="text-xs font-semibold text-brand-black">{t.action}</span>
              </div>
              <p className="text-[11px] text-brand-gray-mid leading-relaxed font-mono">{t.message}</p>
              <p className="text-[10px] text-brand-gray-mid">
                → Send via WhatsApp when API connected
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div className="text-center pb-6">
        <p className="text-[10px] text-brand-gray-mid">
          Intelligence Hub · Generated at {new Date(report.generatedAt).toLocaleString("en-IN")} ·
          {" "}{summary.totalTxns} transactions analysed
        </p>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailPanel({ title, children, onClose }: {
  title: string; children: React.ReactNode; onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-brand-black">{title}</h3>
        <button onClick={onClose} className="text-xs text-brand-gray-mid hover:text-brand-black transition-colors">
          Collapse ↑
        </button>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-36 gap-2">
      <CheckCircle2 className="w-8 h-8 text-brand-gray-light" />
      <p className="text-xs text-brand-gray-mid">{text}</p>
    </div>
  );
}
