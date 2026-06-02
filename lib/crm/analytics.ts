/**
 * Sales OS analytics — the Zoho/Odoo-style reporting layer.
 * Computes funnel, conversion, win/loss, pipeline-by-stage, rep leaderboard,
 * lead-source performance, lead-type split, and activity volume from live data.
 * No DB schema needed — derived from existing CRM tables.
 */
import { getLeads, getDeals, getFollowups } from "./queries";
import { DEAL_STAGES } from "./types";
import type { CrmDealStage } from "@/types/database";

export type StageDatum = { stage: CrmDealStage; label: string; count: number; value: number };
export type LeaderRow = {
  ownerId: string | null;
  name: string;
  wonCount: number;
  wonValue: number;
  openCount: number;
  openValue: number;
  winRate: number;
};

export type SalesAnalytics = {
  kpis: {
    totalLeads: number;
    openDeals: number;
    openPipelineValue: number;
    wonValue: number;
    wonCount: number;
    winRate: number;           // won / (won+lost)
    leadToWin: number;         // won deals / total leads
  };
  funnel: { label: string; count: number }[];
  pipelineByStage: StageDatum[];
  winLoss: { won: number; lost: number; wonValue: number; lostValue: number; winRate: number };
  lostReasons: { reason: string; count: number }[];
  leaderboard: LeaderRow[];
  sourcePerf: { source: string; leads: number; converted: number; rate: number }[];
  leadTypeSplit: { type: string; count: number }[];
  activityByType: { type: string; count: number }[];
  deptSplit: { dept: string; count: number; value: number }[];
  overdueFollowups: number;
};

const OPEN_STAGES = new Set<CrmDealStage>(["new", "qualified", "quoted", "negotiation"]);

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

export async function getSalesAnalytics(): Promise<SalesAnalytics> {
  const [leads, deals, followups] = await Promise.all([getLeads(), getDeals(), getFollowups()]);

  // ── Funnel (leads → qualified → converted → deal → won) ──
  const totalLeads = leads.length;
  const qualifiedLeads = leads.filter((l) => l.status === "qualified" || l.status === "converted").length;
  const convertedLeads = leads.filter((l) => l.converted_account_id || l.status === "converted").length;
  const wonDeals = deals.filter((d) => d.stage === "won");
  const lostDeals = deals.filter((d) => d.stage === "lost");
  const openDeals = deals.filter((d) => OPEN_STAGES.has(d.stage));

  const funnel = [
    { label: "Leads", count: totalLeads },
    { label: "Qualified", count: qualifiedLeads },
    { label: "Converted", count: convertedLeads },
    { label: "Deals", count: deals.length },
    { label: "Won", count: wonDeals.length },
  ];

  // ── Pipeline by stage ──
  const pipelineByStage: StageDatum[] = DEAL_STAGES.map((s) => {
    const inStage = deals.filter((d) => d.stage === s.key);
    return {
      stage: s.key,
      label: s.label,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + (Number(d.value) || 0), 0),
    };
  });

  // ── Win / Loss ──
  const wonValue = wonDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const lostValue = lostDeals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const winRate = pct(wonDeals.length, wonDeals.length + lostDeals.length);

  const lostReasonMap = new Map<string, number>();
  lostDeals.forEach((d) => {
    const r = (d.lost_reason || "Unspecified").trim() || "Unspecified";
    lostReasonMap.set(r, (lostReasonMap.get(r) ?? 0) + 1);
  });
  const lostReasons = [...lostReasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // ── Rep leaderboard ──
  const leaderMap = new Map<string, LeaderRow>();
  const keyFor = (id: string | null, name: string | null) => id ?? `unassigned`;
  for (const d of deals) {
    const k = keyFor(d.owner_id, d.owner_name);
    if (!leaderMap.has(k)) {
      leaderMap.set(k, {
        ownerId: d.owner_id, name: d.owner_name ?? "Unassigned",
        wonCount: 0, wonValue: 0, openCount: 0, openValue: 0, winRate: 0,
      });
    }
    const row = leaderMap.get(k)!;
    const val = Number(d.value) || 0;
    if (d.stage === "won") { row.wonCount++; row.wonValue += val; }
    else if (OPEN_STAGES.has(d.stage)) { row.openCount++; row.openValue += val; }
  }
  // win rate per rep (won / (won+lost))
  const lostByOwner = new Map<string, number>();
  lostDeals.forEach((d) => {
    const k = keyFor(d.owner_id, d.owner_name);
    lostByOwner.set(k, (lostByOwner.get(k) ?? 0) + 1);
  });
  const leaderboard = [...leaderMap.entries()]
    .map(([k, row]) => ({ ...row, winRate: pct(row.wonCount, row.wonCount + (lostByOwner.get(k) ?? 0)) }))
    .sort((a, b) => b.wonValue - a.wonValue || b.openValue - a.openValue);

  // ── Lead source performance ──
  const sourceMap = new Map<string, { leads: number; converted: number }>();
  leads.forEach((l) => {
    const s = (l.source || "Unknown").trim() || "Unknown";
    if (!sourceMap.has(s)) sourceMap.set(s, { leads: 0, converted: 0 });
    const e = sourceMap.get(s)!;
    e.leads++;
    if (l.converted_account_id || l.status === "converted") e.converted++;
  });
  const sourcePerf = [...sourceMap.entries()]
    .map(([source, e]) => ({ source, leads: e.leads, converted: e.converted, rate: pct(e.converted, e.leads) }))
    .sort((a, b) => b.leads - a.leads);

  // ── Lead type split ──
  const typeMap = new Map<string, number>();
  leads.forEach((l) => typeMap.set(l.lead_type, (typeMap.get(l.lead_type) ?? 0) + 1));
  const leadTypeSplit = [...typeMap.entries()].map(([type, count]) => ({ type, count }));

  // ── Activity volume by type ──
  const actMap = new Map<string, number>();
  followups.forEach((a) => actMap.set(a.type, (actMap.get(a.type) ?? 0) + 1));
  const activityByType = [...actMap.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  const overdueFollowups = followups.filter((a) => a.bucket === "overdue").length;

  // ── Department split (deals) ──
  const deptMap = new Map<string, { count: number; value: number }>();
  deals.forEach((d) => {
    if (!deptMap.has(d.department)) deptMap.set(d.department, { count: 0, value: 0 });
    const e = deptMap.get(d.department)!;
    e.count++;
    e.value += Number(d.value) || 0;
  });
  const deptSplit = [...deptMap.entries()].map(([dept, e]) => ({ dept: dept.toUpperCase(), count: e.count, value: e.value }));

  return {
    kpis: {
      totalLeads,
      openDeals: openDeals.length,
      openPipelineValue: openDeals.reduce((s, d) => s + (Number(d.value) || 0), 0),
      wonValue,
      wonCount: wonDeals.length,
      winRate,
      leadToWin: pct(wonDeals.length, totalLeads),
    },
    funnel,
    pipelineByStage,
    winLoss: { won: wonDeals.length, lost: lostDeals.length, wonValue, lostValue, winRate },
    lostReasons,
    leaderboard,
    sourcePerf,
    leadTypeSplit,
    activityByType,
    deptSplit,
    overdueFollowups,
  };
}
