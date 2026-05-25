/**
 * Robotek FinOS — AI Intelligence Engine
 *
 * Pure computation functions — no DB calls, no external APIs.
 * Takes transaction arrays and domain data as input; returns structured insights.
 *
 * Algorithms used:
 *   Anomaly detection   — Z-score (2.5σ threshold) per category
 *   Duplicate detection — Exact + fuzzy match (same vendor ±3 days ±1%)
 *   Fraud signals       — Rule-based pattern matching
 *   Cashflow forecast   — Simple linear regression + rolling average
 *   Vendor risk         — Concentration + frequency + recency scoring
 *   Health score        — Composite weighted score 0–100
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type TxRow = {
  id:               string;
  transaction_date: string;   // YYYY-MM-DD
  voucher_type:     string;
  ledger_name:      string;
  amount:           number;   // always positive (use dr_cr for direction)
  dr_cr:            "DR" | "CR";
  narration:        string | null;
};

export type AnomalyInsight = {
  id:         string;
  date:       string;
  ledger:     string;
  amount:     number;
  zScore:     number;
  category:   string;
  reason:     string;
  severity:   "high" | "medium";
};

export type DuplicateInsight = {
  ids:        [string, string];
  date1:      string;
  date2:      string;
  ledger:     string;
  amount:     number;
  reason:     string;
};

export type FraudSignal = {
  id:         string;
  date:       string;
  ledger:     string;
  amount:     number;
  signal:     string;
  detail:     string;
  risk:       "high" | "medium" | "low";
};

export type GSTIssue = {
  date:       string;
  ledger:     string;
  baseAmount: number;
  taxAmount:  number;
  expectedTax:number;
  rateApplied:number;
  issue:      string;
};

export type CashflowPoint = {
  label:    string;   // "Week 1", "May 2026", etc.
  inflow:   number;
  outflow:  number;
  net:      number;
  projected:boolean;
};

export type VendorRisk = {
  name:           string;
  totalSpend:     number;
  concentration:  number;   // % of total AP
  txnCount:       number;
  avgAmount:      number;
  riskScore:      number;   // 0–100 (100 = highest risk)
  riskLevel:      "high" | "medium" | "low";
  flags:          string[];
};

export type HealthScore = {
  total:       number;   // 0–100
  cashHealth:  number;   // 0–25
  arHealth:    number;   // 0–25
  apHealth:    number;   // 0–25
  complianceH: number;   // 0–25
  grade:       "A" | "B" | "C" | "D" | "F";
  summary:     string;
};

export type WhatChangedItem = {
  metric:    string;
  previous:  number;
  current:   number;
  delta:     number;
  deltaP:    number;   // percentage change
  direction: "up" | "down" | "flat";
  sentiment: "good" | "bad" | "neutral";
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function mean(vals: number[]): number {
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stddev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  const variance = vals.reduce((sum, v) => sum + (v - m) ** 2, 0) / (vals.length - 1);
  return Math.sqrt(variance);
}

function zScore(val: number, m: number, sd: number): number {
  return sd === 0 ? 0 : (val - m) / sd;
}

function formatINR(n: number): string {
  if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(1)}Cr`;
  if (n >= 1_00_000)    return `₹${(n / 1_00_000).toFixed(1)}L`;
  if (n >= 1_000)       return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

// ── 1. Anomaly Detection ─────────────────────────────────────────────────────

export function detectAnomalies(txns: TxRow[]): AnomalyInsight[] {
  const insights: AnomalyInsight[] = [];

  // Group by voucher_type (category)
  const byCategory: Record<string, TxRow[]> = {};
  for (const t of txns) {
    (byCategory[t.voucher_type] ??= []).push(t);
  }

  for (const [category, group] of Object.entries(byCategory)) {
    if (group.length < 3) continue; // not enough data for stats

    const amounts = group.map((t) => t.amount);
    const m  = mean(amounts);
    const sd = stddev(amounts);

    for (const t of group) {
      const z = zScore(t.amount, m, sd);
      if (Math.abs(z) >= 2.5) {
        insights.push({
          id:       t.id,
          date:     t.transaction_date,
          ledger:   t.ledger_name,
          amount:   t.amount,
          zScore:   parseFloat(z.toFixed(1)),
          category,
          reason:   `${formatINR(t.amount)} is ${Math.abs(z).toFixed(1)}σ ${z > 0 ? "above" : "below"} the ${category} average of ${formatINR(m)}`,
          severity: Math.abs(z) >= 3.5 ? "high" : "medium",
        });
      }
    }
  }

  // Also flag: very large single transactions (> ₹5L) regardless of category
  for (const t of txns) {
    if (t.amount >= 500_000 && !insights.find((i) => i.id === t.id)) {
      insights.push({
        id:       t.id,
        date:     t.transaction_date,
        ledger:   t.ledger_name,
        amount:   t.amount,
        zScore:   0,
        category: t.voucher_type,
        reason:   `Large transaction: ${formatINR(t.amount)} — requires review`,
        severity: "high",
      });
    }
  }

  return insights.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 15);
}

// ── 2. Duplicate Payment Detection ───────────────────────────────────────────

export function detectDuplicates(txns: TxRow[]): DuplicateInsight[] {
  const duplicates: DuplicateInsight[] = [];
  const checked = new Set<string>();

  // Only check DR (outgoing payments)
  const payments = txns.filter((t) => t.dr_cr === "DR").sort(
    (a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
  );

  for (let i = 0; i < payments.length; i++) {
    for (let j = i + 1; j < payments.length; j++) {
      const a = payments[i];
      const b = payments[j];

      const key = [a.id, b.id].sort().join("-");
      if (checked.has(key)) continue;

      const daysDiff = Math.abs(
        (new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()) / 86_400_000
      );
      if (daysDiff > 30) break; // sorted by date, no need to check further

      const sameVendor = a.ledger_name.toLowerCase().trim() === b.ledger_name.toLowerCase().trim();
      const amountDiff = Math.abs(a.amount - b.amount) / Math.max(a.amount, b.amount);
      const nearAmount = amountDiff < 0.01; // within 1%

      if (sameVendor && nearAmount && daysDiff <= 7) {
        checked.add(key);
        duplicates.push({
          ids:    [a.id, b.id],
          date1:  a.transaction_date,
          date2:  b.transaction_date,
          ledger: a.ledger_name,
          amount: a.amount,
          reason: daysDiff === 0
            ? `Exact duplicate: same vendor + same amount on the same day`
            : `Possible duplicate: same vendor (${a.ledger_name}) + same amount within ${Math.round(daysDiff)} day${Math.round(daysDiff) !== 1 ? "s" : ""}`,
        });
      }
    }
  }

  return duplicates.slice(0, 10);
}

// ── 3. Fraud Signals ─────────────────────────────────────────────────────────

export function detectFraudSignals(txns: TxRow[]): FraudSignal[] {
  const signals: FraudSignal[] = [];

  // Rule 1: Just-under-threshold amounts (₹49,999 / ₹99,999 / ₹99,000 / ₹1,99,999)
  const THRESHOLDS = [50_000, 1_00_000, 2_00_000, 5_00_000, 10_00_000];
  for (const t of txns.filter((x) => x.dr_cr === "DR")) {
    for (const threshold of THRESHOLDS) {
      if (t.amount >= threshold * 0.97 && t.amount < threshold) {
        signals.push({
          id:     t.id,
          date:   t.transaction_date,
          ledger: t.ledger_name,
          amount: t.amount,
          signal: "Just-below-threshold",
          detail: `${formatINR(t.amount)} is just below the ₹${formatINR(threshold)} reporting/approval threshold`,
          risk:   "high",
        });
        break;
      }
    }
  }

  // Rule 2: Rapid succession — same vendor, multiple DR payments within 3 days
  const byVendor: Record<string, TxRow[]> = {};
  for (const t of txns.filter((x) => x.dr_cr === "DR")) {
    (byVendor[t.ledger_name.toLowerCase()] ??= []).push(t);
  }
  for (const [vendor, group] of Object.entries(byVendor)) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    for (let i = 1; i < sorted.length; i++) {
      const days = (new Date(sorted[i].transaction_date).getTime() - new Date(sorted[i - 1].transaction_date).getTime()) / 86_400_000;
      if (days <= 3) {
        const existing = signals.find((s) => s.ledger.toLowerCase() === vendor && s.signal === "Rapid-succession");
        if (!existing) {
          signals.push({
            id:     sorted[i].id,
            date:   sorted[i].transaction_date,
            ledger: sorted[i].ledger_name,
            amount: sorted[i].amount + sorted[i - 1].amount,
            signal: "Rapid-succession",
            detail: `Multiple payments to ${sorted[i].ledger_name} within ${Math.round(days)} day${Math.round(days) !== 1 ? "s" : ""} — verify if intentional`,
            risk:   "medium",
          });
        }
      }
    }
  }

  // Rule 3: Round-number large amounts (exact multiples of ₹1L+)
  for (const t of txns.filter((x) => x.dr_cr === "DR" && x.amount >= 1_00_000)) {
    if (t.amount % 1_00_000 === 0) {
      if (!signals.find((s) => s.id === t.id)) {
        signals.push({
          id:     t.id,
          date:   t.transaction_date,
          ledger: t.ledger_name,
          amount: t.amount,
          signal: "Round-number",
          detail: `Exact round-number payment of ${formatINR(t.amount)} — typical in fraudulent entries`,
          risk:   "low",
        });
      }
    }
  }

  return signals
    .sort((a, b) => (a.risk === "high" ? -1 : b.risk === "high" ? 1 : 0))
    .slice(0, 12);
}

// ── 4. GST Mismatch Detection ─────────────────────────────────────────────────

export function detectGSTMismatches(txns: TxRow[]): GSTIssue[] {
  const issues: GSTIssue[] = [];
  const GST_RATES = [0.05, 0.12, 0.18, 0.28];

  // Find pairs: Sales/Purchase + corresponding GST ledger on same date
  const gstLedgers = txns.filter((t) =>
    /gst|igst|cgst|sgst|tax/i.test(t.ledger_name)
  );

  for (const gstTxn of gstLedgers) {
    // Find the corresponding base transaction (same date ±1 day, same direction)
    const baseTxn = txns.find((t) =>
      t.id !== gstTxn.id &&
      !(/gst|igst|cgst|sgst|tax/i.test(t.ledger_name)) &&
      Math.abs(new Date(t.transaction_date).getTime() - new Date(gstTxn.transaction_date).getTime()) <= 86_400_000 &&
      t.voucher_type === gstTxn.voucher_type
    );

    if (!baseTxn) continue;

    const taxAmount  = gstTxn.amount;
    const baseAmount = baseTxn.amount;
    const effectiveRate = taxAmount / baseAmount;

    // Check if rate matches any standard GST rate (within 0.5%)
    const isValidRate = GST_RATES.some((r) => Math.abs(effectiveRate - r) < 0.005);

    if (!isValidRate && effectiveRate > 0) {
      const closestRate = GST_RATES.reduce((prev, curr) =>
        Math.abs(curr - effectiveRate) < Math.abs(prev - effectiveRate) ? curr : prev
      );

      issues.push({
        date:        gstTxn.transaction_date,
        ledger:      baseTxn.ledger_name,
        baseAmount,
        taxAmount,
        expectedTax: parseFloat((baseAmount * closestRate).toFixed(2)),
        rateApplied: parseFloat((effectiveRate * 100).toFixed(1)),
        issue:       `Tax rate ${(effectiveRate * 100).toFixed(1)}% applied — expected ${(closestRate * 100).toFixed(0)}% (${closestRate === 0.18 ? "standard" : closestRate === 0.28 ? "luxury" : closestRate === 0.12 ? "reduced" : "zero"} rate). Difference: ${formatINR(Math.abs(taxAmount - baseAmount * closestRate))}`,
      });
    }
  }

  return issues.slice(0, 10);
}

// ── 5. Cashflow Prediction ────────────────────────────────────────────────────

export function predictCashflow(txns: TxRow[]): CashflowPoint[] {
  // Group by month
  const monthly: Record<string, { inflow: number; outflow: number }> = {};

  for (const t of txns) {
    const key = t.transaction_date.slice(0, 7); // YYYY-MM
    if (!monthly[key]) monthly[key] = { inflow: 0, outflow: 0 };
    if (t.dr_cr === "CR") monthly[key].inflow  += t.amount;
    else                  monthly[key].outflow += t.amount;
  }

  const sortedKeys = Object.keys(monthly).sort();
  const historicalPoints: CashflowPoint[] = sortedKeys.map((key) => {
    const d = monthly[key];
    return {
      label:    formatMonthLabel(key),
      inflow:   d.inflow,
      outflow:  d.outflow,
      net:      d.inflow - d.outflow,
      projected:false,
    };
  });

  // Linear regression on net cashflow
  const nets = historicalPoints.map((p) => p.net);
  const n    = nets.length;
  if (n < 2) return historicalPoints;

  const xs   = nets.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(nets);

  const slope = xs.reduce((sum, x, i) => sum + (x - xMean) * (nets[i] - yMean), 0) /
                xs.reduce((sum, x)    => sum + (x - xMean) ** 2, 0.001);
  const intercept = yMean - slope * xMean;

  // Project 3 months forward
  const lastKey = sortedKeys[sortedKeys.length - 1];
  const projectedPoints: CashflowPoint[] = [];
  for (let i = 1; i <= 3; i++) {
    const projKey  = addMonths(lastKey, i);
    const projNet  = intercept + slope * (n + i - 1);
    const avgRatio = nets.length > 0
      ? historicalPoints.slice(-3).reduce((s, p) => s + (p.inflow > 0 ? p.outflow / p.inflow : 1), 0) / 3
      : 0.8;
    const projInflow  = projNet / (1 - Math.min(avgRatio, 0.99));
    const projOutflow = projInflow * avgRatio;

    projectedPoints.push({
      label:    `${formatMonthLabel(projKey)} (est.)`,
      inflow:   Math.max(projInflow, 0),
      outflow:  Math.max(projOutflow, 0),
      net:      projNet,
      projected:true,
    });
  }

  return [...historicalPoints.slice(-9), ...projectedPoints];
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

function addMonths(key: string, n: number): string {
  const [year, month] = key.split("-").map(Number);
  const d = new Date(year, month - 1 + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── 6. Vendor Risk Scoring ────────────────────────────────────────────────────

export function scoreVendorRisk(txns: TxRow[]): VendorRisk[] {
  // Only debit (outgoing) non-system transactions
  const payments = txns.filter((t) =>
    t.dr_cr === "DR" &&
    !["Purchase A/c", "Sales A/c", "Bank", "Cash"].some((s) =>
      t.ledger_name.toLowerCase().includes(s.toLowerCase())
    ) &&
    !(/gst|igst|cgst|sgst|tax/i.test(t.ledger_name))
  );

  const totalSpend = payments.reduce((s, t) => s + t.amount, 0);

  const byVendor: Record<string, TxRow[]> = {};
  for (const t of payments) {
    (byVendor[t.ledger_name] ??= []).push(t);
  }

  const risks: VendorRisk[] = [];

  for (const [name, group] of Object.entries(byVendor)) {
    if (group.length === 0) continue;

    const spend         = group.reduce((s, t) => s + t.amount, 0);
    const concentration = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
    const avgAmt        = spend / group.length;
    const flags: string[] = [];
    let riskScore       = 0;

    // Concentration risk
    if (concentration > 30) { riskScore += 40; flags.push(`High concentration: ${concentration.toFixed(0)}% of total AP`); }
    else if (concentration > 15) { riskScore += 20; flags.push(`Moderate concentration: ${concentration.toFixed(0)}% of AP`); }

    // High single payment
    const maxPayment = Math.max(...group.map((t) => t.amount));
    if (maxPayment > 5_00_000) { riskScore += 25; flags.push(`Large payment: ${formatINR(maxPayment)}`); }
    else if (maxPayment > 1_00_000) { riskScore += 10; }

    // High frequency (many small payments — could indicate card/subscription abuse)
    if (group.length > 10) { riskScore += 15; flags.push(`High frequency: ${group.length} payments`); }

    // New vendor (first payment within last 90 days, high amount)
    const newest = group.reduce((a, b) => a.transaction_date > b.transaction_date ? a : b);
    const newest_days = (Date.now() - new Date(newest.transaction_date).getTime()) / 86_400_000;
    if (newest_days < 90 && spend > 2_00_000) {
      riskScore += 20;
      flags.push("Recent high-value vendor");
    }

    riskScore = Math.min(riskScore, 100);

    risks.push({
      name,
      totalSpend: spend,
      concentration: parseFloat(concentration.toFixed(1)),
      txnCount:   group.length,
      avgAmount:  avgAmt,
      riskScore,
      riskLevel:  riskScore >= 60 ? "high" : riskScore >= 30 ? "medium" : "low",
      flags,
    });
  }

  return risks
    .filter((r) => r.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
}

// ── 7. Financial Health Score ─────────────────────────────────────────────────

export function calculateHealthScore(params: {
  cashBalance:       number;    // current cash in bank (rupees)
  totalAR:           number;    // total AR outstanding
  overdueAR:         number;    // AR overdue
  totalAP:           number;    // total AP outstanding
  overdueAP:         number;    // AP overdue
  complianceTotal:   number;    // total compliance items
  complianceFiled:   number;    // filed/paid
  complianceOverdue: number;    // overdue
}): HealthScore {
  const {
    cashBalance, totalAR, overdueAR,
    totalAP, overdueAP,
    complianceTotal, complianceFiled, complianceOverdue,
  } = params;

  // Each component is out of 25

  // Cash health: > ₹50L = 25, > ₹10L = 20, > ₹5L = 15, > ₹1L = 10, else 5
  const cashH =
    cashBalance >= 50_00_000 ? 25 :
    cashBalance >= 10_00_000 ? 20 :
    cashBalance >= 5_00_000  ? 15 :
    cashBalance >= 1_00_000  ? 10 : 5;

  // AR health: % overdue < 10% = 25, < 25% = 18, < 50% = 12, else 5
  const overdueARPct = totalAR > 0 ? (overdueAR / totalAR) * 100 : 0;
  const arH =
    overdueARPct < 10  ? 25 :
    overdueARPct < 25  ? 18 :
    overdueARPct < 50  ? 12 : 5;

  // AP health: no overdue = 25, < 10% = 20, < 25% = 15, else 8
  const overdueAPPct = totalAP > 0 ? (overdueAP / totalAP) * 100 : 0;
  const apH =
    overdueAPPct === 0 ? 25 :
    overdueAPPct < 10  ? 20 :
    overdueAPPct < 25  ? 15 : 8;

  // Compliance health: all filed = 25, no overdue = 20, 1 overdue = 15, >1 = 5
  const compH =
    complianceTotal === 0       ? 20 :
    complianceOverdue === 0 && complianceFiled === complianceTotal ? 25 :
    complianceOverdue === 0     ? 20 :
    complianceOverdue === 1     ? 15 : 5;

  const total = cashH + arH + apH + compH;
  const grade: HealthScore["grade"] =
    total >= 90 ? "A" :
    total >= 75 ? "B" :
    total >= 60 ? "C" :
    total >= 45 ? "D" : "F";

  const issues = [];
  if (complianceOverdue > 0) issues.push(`${complianceOverdue} compliance overdue`);
  if (overdueARPct > 25)     issues.push(`${overdueARPct.toFixed(0)}% AR overdue`);
  if (overdueAPPct > 10)     issues.push(`${overdueAPPct.toFixed(0)}% AP overdue`);
  if (cashBalance < 5_00_000) issues.push("Low cash balance");

  const summary = issues.length === 0
    ? "All key financial indicators are healthy."
    : `Areas needing attention: ${issues.join(", ")}.`;

  return { total, cashHealth: cashH, arHealth: arH, apHealth: apH, complianceH: compH, grade, summary };
}

// ── 8. Bank Reconciliation ────────────────────────────────────────────────────

export type ReconciliationItem = {
  bankEntry:    { date: string; description: string; amount: number; dr_cr: "DR" | "CR" };
  matchedTxn:   TxRow | null;
  matchScore:   number;  // 0–100
  matchReason:  string;
  status:       "matched" | "partial" | "unmatched";
};

export function reconcileBank(
  bankEntries: { date: string; description: string; amount: number; dr_cr: "DR" | "CR" }[],
  ledgerTxns:  TxRow[],
): ReconciliationItem[] {
  return bankEntries.map((entry) => {
    // Try exact match: same amount, same direction, within 3 days
    let best: TxRow | null = null;
    let bestScore = 0;
    let bestReason = "";

    for (const txn of ledgerTxns) {
      if (txn.dr_cr !== entry.dr_cr) continue;

      const daysDiff = Math.abs(
        (new Date(entry.date).getTime() - new Date(txn.transaction_date).getTime()) / 86_400_000
      );
      if (daysDiff > 7) continue;

      let score = 0;
      const reasons: string[] = [];

      // Exact amount
      if (Math.abs(txn.amount - entry.amount) < 1) { score += 50; reasons.push("exact amount"); }
      else if (Math.abs(txn.amount - entry.amount) / entry.amount < 0.01) { score += 30; reasons.push("near amount"); }

      // Same day
      if (daysDiff === 0) { score += 30; reasons.push("same date"); }
      else if (daysDiff <= 1) { score += 20; }
      else if (daysDiff <= 3) { score += 10; }

      // Description match
      const descWords = entry.description.toLowerCase().split(/\s+/);
      const ledgerWords = txn.ledger_name.toLowerCase().split(/\s+/);
      const common = descWords.filter((w) => w.length > 2 && ledgerWords.some((l) => l.includes(w)));
      if (common.length > 0) { score += Math.min(common.length * 5, 20); reasons.push("name match"); }

      if (score > bestScore) {
        bestScore  = score;
        best       = txn;
        bestReason = reasons.join(" + ");
      }
    }

    const status: ReconciliationItem["status"] =
      bestScore >= 70 ? "matched" :
      bestScore >= 40 ? "partial" : "unmatched";

    return {
      bankEntry:   entry,
      matchedTxn:  bestScore >= 40 ? best : null,
      matchScore:  bestScore,
      matchReason: bestReason || "No close match found",
      status,
    };
  });
}

// ── 9. "What Changed Today" ───────────────────────────────────────────────────

export function whatChanged(
  today:     { inflow: number; outflow: number; txnCount: number; cashBalance: number },
  yesterday: { inflow: number; outflow: number; txnCount: number; cashBalance: number },
): WhatChangedItem[] {
  function item(
    metric:    string,
    prev:      number,
    curr:      number,
    higherIsBetter: boolean,
  ): WhatChangedItem {
    const delta  = curr - prev;
    const deltaP = prev === 0 ? 0 : (delta / prev) * 100;
    const dir: WhatChangedItem["direction"] = Math.abs(delta) < 1 ? "flat" : delta > 0 ? "up" : "down";
    const good = (higherIsBetter && delta > 0) || (!higherIsBetter && delta < 0);
    return {
      metric, previous: prev, current: curr, delta,
      deltaP: parseFloat(deltaP.toFixed(1)),
      direction: dir,
      sentiment: dir === "flat" ? "neutral" : good ? "good" : "bad",
    };
  }

  return [
    item("Cash Balance",       yesterday.cashBalance, today.cashBalance, true),
    item("Inflow",             yesterday.inflow,      today.inflow,      true),
    item("Outflow",            yesterday.outflow,     today.outflow,     false),
    item("Net Cashflow",       yesterday.inflow - yesterday.outflow, today.inflow - today.outflow, true),
    item("Transactions Today", yesterday.txnCount,    today.txnCount,    true),
  ];
}
