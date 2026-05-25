"use server";

/**
 * AI Insights Server Actions
 * Fetches real data from Supabase, runs the AI engine, returns a full report.
 * Called by the Intel Hub page.
 */

import { createClient }              from "@/lib/supabase/server";
import { getSelectedCompanyId }      from "@/lib/company-cookie";
import {
  detectAnomalies,
  detectDuplicates,
  detectFraudSignals,
  detectGSTMismatches,
  predictCashflow,
  scoreVendorRisk,
  calculateHealthScore,
  whatChanged,
  type TxRow,
  type AnomalyInsight,
  type DuplicateInsight,
  type FraudSignal,
  type GSTIssue,
  type CashflowPoint,
  type VendorRisk,
  type HealthScore,
  type WhatChangedItem,
} from "@/lib/ai-engine";

// ── Public types ──────────────────────────────────────────────────────────────

export type IntelligenceReport = {
  healthScore:    HealthScore;
  anomalies:      AnomalyInsight[];
  duplicates:     DuplicateInsight[];
  fraudSignals:   FraudSignal[];
  gstIssues:      GSTIssue[];
  cashflowForecast: CashflowPoint[];
  vendorRisk:     VendorRisk[];
  whatChanged:    WhatChangedItem[];
  summary: {
    totalTxns:     number;
    totalInflow:   number;
    totalOutflow:  number;
    netCashflow:   number;
    cashBalance:   number;
    alertCount:    number;
  };
  generatedAt: string;
};

// ── Main action ───────────────────────────────────────────────────────────────

export async function getIntelligenceReport(): Promise<IntelligenceReport> {
  const supabase   = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db         = supabase as any;
  const companyId  = await getSelectedCompanyId();

  // ── Fetch transactions ────────────────────────────────────────────────────
  let txnQuery = db
    .from("transactions")
    .select("id, transaction_date, voucher_type, voucher_number, ledger_name, amount, dr_cr, narration")
    .order("transaction_date", { ascending: true });

  if (companyId) txnQuery = txnQuery.eq("company_id", companyId);

  const { data: rawTxns } = await txnQuery as { data: TxRow[] | null };
  const txns: TxRow[] = (rawTxns ?? []).map((t) => ({
    ...t,
    amount: typeof t.amount === "string" ? parseFloat(t.amount) : t.amount,
  }));

  // ── Fetch compliance ──────────────────────────────────────────────────────
  let compQuery = db
    .from("compliance_items")
    .select("status, due_date");
  if (companyId) compQuery = compQuery.eq("company_id", companyId);
  const { data: compItems } = await compQuery as {
    data: { status: string; due_date: string }[] | null;
  };

  const today = new Date().toISOString().split("T")[0];
  const compliance = compItems ?? [];
  const complianceTotal   = compliance.length;
  const complianceFiled   = compliance.filter((c) => c.status === "filed" || c.status === "paid").length;
  const complianceOverdue = compliance.filter((c) =>
    c.status === "overdue" || (c.due_date < today && c.status === "pending")
  ).length;

  // ── Derive cashflow metrics ───────────────────────────────────────────────
  const totalInflow  = txns.filter((t) => t.dr_cr === "CR").reduce((s, t) => s + t.amount, 0);
  const totalOutflow = txns.filter((t) => t.dr_cr === "DR").reduce((s, t) => s + t.amount, 0);
  const netCashflow  = totalInflow - totalOutflow;

  // Approximate cash balance from transactions (simplified)
  const cashBalance  = Math.max(netCashflow, 0);

  // ── "What changed today" — compare today vs yesterday ────────────────────
  const todayStr     = today;
  const yesterdayStr = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];

  const todayTxns     = txns.filter((t) => t.transaction_date === todayStr);
  const yesterdayTxns = txns.filter((t) => t.transaction_date === yesterdayStr);

  const todayInflow  = todayTxns.filter((t)     => t.dr_cr === "CR").reduce((s, t) => s + t.amount, 0);
  const todayOutflow = todayTxns.filter((t)     => t.dr_cr === "DR").reduce((s, t) => s + t.amount, 0);
  const yestInflow   = yesterdayTxns.filter((t) => t.dr_cr === "CR").reduce((s, t) => s + t.amount, 0);
  const yestOutflow  = yesterdayTxns.filter((t) => t.dr_cr === "DR").reduce((s, t) => s + t.amount, 0);

  // Running balance: use all historical to get yesterday's, and today's
  const historyUntilYesterday = txns.filter((t) => t.transaction_date <= yesterdayStr);
  const historyUntilToday     = txns.filter((t) => t.transaction_date <= todayStr);

  function runningBalance(arr: TxRow[]) {
    return arr.reduce((bal, t) => bal + (t.dr_cr === "CR" ? t.amount : -t.amount), 0);
  }

  const balanceYesterday = runningBalance(historyUntilYesterday);
  const balanceToday     = runningBalance(historyUntilToday);

  const changed = whatChanged(
    { inflow: todayInflow,  outflow: todayOutflow,  txnCount: todayTxns.length,     cashBalance: balanceToday },
    { inflow: yestInflow,   outflow: yestOutflow,   txnCount: yesterdayTxns.length, cashBalance: balanceYesterday },
  );

  // ── Run AI engines ────────────────────────────────────────────────────────
  const [anomalies, duplicates, fraudSignals, gstIssues, forecast, vendorRisk, health] = [
    detectAnomalies(txns),
    detectDuplicates(txns),
    detectFraudSignals(txns),
    detectGSTMismatches(txns),
    predictCashflow(txns),
    scoreVendorRisk(txns),
    calculateHealthScore({
      cashBalance:       Math.max(balanceToday, 0),
      totalAR:           50_00_000,     // TODO: from customers table
      overdueAR:         10_00_000,     // TODO: from customers table
      totalAP:           20_00_000,     // TODO: from vendors table
      overdueAP:         2_00_000,      // TODO: from vendors table
      complianceTotal,
      complianceFiled,
      complianceOverdue,
    }),
  ];

  const alertCount = anomalies.length + duplicates.length +
    fraudSignals.filter((f) => f.risk === "high").length + gstIssues.length;

  return {
    healthScore:     health,
    anomalies,
    duplicates,
    fraudSignals,
    gstIssues,
    cashflowForecast: forecast,
    vendorRisk,
    whatChanged:     changed,
    summary: {
      totalTxns:   txns.length,
      totalInflow,
      totalOutflow,
      netCashflow,
      cashBalance: balanceToday,
      alertCount,
    },
    generatedAt: new Date().toISOString(),
  };
}
