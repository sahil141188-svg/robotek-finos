/**
 * Compliance Data — Module 3: Compliance Calendar
 *
 * Generates all statutory compliance items for FY 2026-27 (Robotek India).
 * Covers: GST, TDS, TCS, PF, ESI, Advance Tax, ROC, Income Tax, Prof Tax.
 *
 * Statuses for demo context (today = 2026-05-21):
 *   - April period items (due May 7-20): filed / paid
 *   - TCS Q4 FY25-26 quarterly return (due May 15): overdue (intentional demo miss)
 *   - TDS Q4 FY25-26 quarterly returns (due May 31): pending (due in 10 days)
 *   - Everything else: pending
 */

export type ComplianceStatus = "pending" | "filed" | "paid" | "overdue" | "not_applicable";

export type ComplianceCategoryId =
  | "GST" | "TDS" | "TCS" | "PF" | "ESI"
  | "AdvanceTax" | "ROC" | "IncomeTax" | "ProfTax";

export type ComplianceItem = {
  id: string;
  category: ComplianceCategoryId;
  title: string;
  description: string;
  due_date: string;           // YYYY-MM-DD
  status: ComplianceStatus;
  financial_year: string;
  period: string;             // "Apr 2026", "Q1 2026-27", "FY 2025-26", etc.
  assigned_to: string | null;
  filed_date: string | null;
  acknowledgement_number: string | null;
  notes: string | null;
  is_recurring: boolean;
  forms: string[];            // required form names
  late_fee: string;           // human-readable penalty description
  amount_due: number | null;  // estimated tax/liability in INR (null if variable)
};

// ─── Category metadata ────────────────────────────────────────────────────────

export const CATEGORY_META: Record<
  ComplianceCategoryId,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  GST:         { label: "GST",          bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200",   icon: "🧾" },
  TDS:         { label: "TDS",          bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: "📑" },
  TCS:         { label: "TCS",          bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", icon: "📋" },
  PF:          { label: "PF",           bg: "bg-teal-50",   text: "text-teal-700",   border: "border-teal-200",   icon: "🏦" },
  ESI:         { label: "ESI",          bg: "bg-cyan-50",   text: "text-cyan-700",   border: "border-cyan-200",   icon: "🏥" },
  AdvanceTax:  { label: "Advance Tax",  bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: "💰" },
  ROC:         { label: "ROC",          bg: "bg-rose-50",   text: "text-rose-700",   border: "border-rose-200",   icon: "🏛️" },
  IncomeTax:   { label: "Income Tax",   bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200",  icon: "📊" },
  ProfTax:     { label: "Prof Tax",     bg: "bg-lime-50",   text: "text-lime-700",   border: "border-lime-200",   icon: "🎓" },
};

// ─── Status metadata ──────────────────────────────────────────────────────────

export function getStatusMeta(status: ComplianceStatus) {
  switch (status) {
    case "filed":          return { label: "Filed",       className: "bg-green-100 text-green-800 border-green-200" };
    case "paid":           return { label: "Paid",        className: "bg-green-100 text-green-800 border-green-200" };
    case "overdue":        return { label: "Overdue",     className: "bg-red-100 text-red-800 border-red-200" };
    case "not_applicable": return { label: "N/A",         className: "bg-gray-100 text-gray-600 border-gray-200" };
    default:               return { label: "Pending",     className: "bg-amber-100 text-amber-800 border-amber-200" };
  }
}

// ─── Data generators ──────────────────────────────────────────────────────────

function dd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Dynamic today — computed at runtime so overdue detection stays accurate
const TODAY = new Date().toISOString().slice(0, 10);

/** Auto-assign status: if due date is past and we haven't marked it filed, it's overdue. */
function autoStatus(
  dueDate: string,
  override?: ComplianceStatus,
): ComplianceStatus {
  if (override) return override;
  if (dueDate < TODAY) return "overdue";
  return "pending";
}

/**
 * Monthly period → next month (where deposits/filings are due).
 * Apr 2026 → May 2026 (y=2026, m=5) … Mar 2027 → Apr 2027 (y=2027, m=4)
 */
const MONTHLY_PERIODS = [
  { period: "Apr 2026", nY: 2026, nM: 5 },
  { period: "May 2026", nY: 2026, nM: 6 },
  { period: "Jun 2026", nY: 2026, nM: 7 },
  { period: "Jul 2026", nY: 2026, nM: 8 },
  { period: "Aug 2026", nY: 2026, nM: 9 },
  { period: "Sep 2026", nY: 2026, nM: 10 },
  { period: "Oct 2026", nY: 2026, nM: 11 },
  { period: "Nov 2026", nY: 2026, nM: 12 },
  { period: "Dec 2026", nY: 2027, nM: 1 },
  { period: "Jan 2027", nY: 2027, nM: 2 },
  { period: "Feb 2027", nY: 2027, nM: 3 },
  { period: "Mar 2027", nY: 2027, nM: 4 },
] as const;

// For April period items we know they've been filed/paid (it's May 21)
function aprOverride(nM: number, type: "filed" | "paid"): ComplianceStatus | undefined {
  return nM === 5 ? type : undefined; // only April period's due dates land in May
}

// ─── Generate all items ───────────────────────────────────────────────────────

function generateItems(): ComplianceItem[] {
  const items: ComplianceItem[] = [];

  // ── Monthly GST ────────────────────────────────────────────────────────────
  for (const { period, nY, nM } of MONTHLY_PERIODS) {
    const dueGSTR1  = dd(nY, nM, 11);
    const dueGSTR3B = dd(nY, nM, 20);

    items.push({
      id: `gstr1-${period.replace(" ", "-").toLowerCase()}`,
      category: "GST", title: "GSTR-1", period,
      description: "Monthly outward supplies return — report all sales invoices",
      due_date: dueGSTR1,
      status: autoStatus(dueGSTR1, aprOverride(nM, "filed")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-10" : null,
      acknowledgement_number: nM === 5 ? `ARN-GSTR1-APR26` : null,
      notes: null, is_recurring: true,
      forms: ["GSTR-1"],
      late_fee: "₹200/day (nil return); ₹200/day max ₹5,000 (with data)",
      amount_due: null,
    });

    items.push({
      id: `gstr3b-${period.replace(" ", "-").toLowerCase()}`,
      category: "GST", title: "GSTR-3B", period,
      description: "Monthly summary return — declare GST liability and claim ITC",
      due_date: dueGSTR3B,
      status: autoStatus(dueGSTR3B, aprOverride(nM, "filed")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-20" : null,
      acknowledgement_number: nM === 5 ? `ARN-GSTR3B-APR26` : null,
      notes: null, is_recurring: true,
      forms: ["GSTR-3B"],
      late_fee: "₹50/day + 18% p.a. interest on unpaid tax liability",
      amount_due: null,
    });

    items.push({
      id: `itc-recon-${period.replace(" ", "-").toLowerCase()}`,
      category: "GST", title: "ITC Reconciliation", period,
      description: "Reconcile input tax credit with GSTR-2B before filing GSTR-3B",
      due_date: dueGSTR3B,
      status: autoStatus(dueGSTR3B, aprOverride(nM, "filed")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-19" : null,
      acknowledgement_number: null,
      notes: null, is_recurring: true,
      forms: ["GSTR-2B"],
      late_fee: "ITC reversal + 18% interest if excess credit claimed",
      amount_due: null,
    });
  }

  // ── Monthly TDS Deposit ────────────────────────────────────────────────────
  for (const { period, nY, nM } of MONTHLY_PERIODS) {
    const dueDate = dd(nY, nM, 7);
    items.push({
      id: `tds-deposit-${period.replace(" ", "-").toLowerCase()}`,
      category: "TDS", title: "TDS Deposit", period,
      description: "Deposit TDS deducted in the previous month to government account",
      due_date: dueDate,
      status: autoStatus(dueDate, aprOverride(nM, "paid")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-06" : null,
      acknowledgement_number: nM === 5 ? "BSR-TDS-APR26" : null,
      notes: null, is_recurring: true,
      forms: ["Challan 281"],
      late_fee: "1.5% per month (Sec 201) + 1% per month interest (Sec 220)",
      amount_due: null,
    });
  }

  // ── Monthly TCS Deposit ────────────────────────────────────────────────────
  for (const { period, nY, nM } of MONTHLY_PERIODS) {
    const dueDate = dd(nY, nM, 7);
    items.push({
      id: `tcs-deposit-${period.replace(" ", "-").toLowerCase()}`,
      category: "TCS", title: "TCS Deposit", period,
      description: "Deposit TCS collected in the previous month to government account",
      due_date: dueDate,
      status: autoStatus(dueDate, aprOverride(nM, "paid")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-06" : null,
      acknowledgement_number: nM === 5 ? "BSR-TCS-APR26" : null,
      notes: null, is_recurring: true,
      forms: ["Challan 281"],
      late_fee: "1% per month (Sec 206C) + 1% per month interest",
      amount_due: null,
    });
  }

  // ── Monthly PF Deposit ────────────────────────────────────────────────────
  for (const { period, nY, nM } of MONTHLY_PERIODS) {
    const dueDate = dd(nY, nM, 15);
    items.push({
      id: `pf-deposit-${period.replace(" ", "-").toLowerCase()}`,
      category: "PF", title: "PF Deposit", period,
      description: "Deposit Provident Fund contributions (employee + employer share)",
      due_date: dueDate,
      status: autoStatus(dueDate, aprOverride(nM, "paid")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-15" : null,
      acknowledgement_number: null, notes: null, is_recurring: true,
      forms: ["ECR (Electronic Challan cum Return)"],
      late_fee: "12% p.a. damages + penal damages 5%-25% on defaulted amount",
      amount_due: null,
    });
  }

  // ── Monthly ESI Deposit ────────────────────────────────────────────────────
  for (const { period, nY, nM } of MONTHLY_PERIODS) {
    const dueDate = dd(nY, nM, 15);
    items.push({
      id: `esi-deposit-${period.replace(" ", "-").toLowerCase()}`,
      category: "ESI", title: "ESI Deposit", period,
      description: "Deposit ESI contributions (employee 0.75% + employer 3.25% of wages)",
      due_date: dueDate,
      status: autoStatus(dueDate, aprOverride(nM, "paid")),
      financial_year: "2026-27", assigned_to: null,
      filed_date:  nM === 5 ? "2026-05-15" : null,
      acknowledgement_number: null, notes: null, is_recurring: true,
      forms: ["ESI Challan"],
      late_fee: "12% p.a. simple interest on delayed contribution",
      amount_due: null,
    });
  }

  // ── Quarterly TDS Returns (26Q and 24Q) ───────────────────────────────────
  const TDS_QUARTERS = [
    { period: "Q1 2026-27 (Apr–Jun)", quarter: "Q1", due26Q: "2026-07-31", due24Q: "2026-07-31" },
    { period: "Q2 2026-27 (Jul–Sep)", quarter: "Q2", due26Q: "2026-10-31", due24Q: "2026-10-31" },
    { period: "Q3 2026-27 (Oct–Dec)", quarter: "Q3", due26Q: "2027-01-31", due24Q: "2027-01-31" },
    { period: "Q4 2026-27 (Jan–Mar)", quarter: "Q4", due26Q: "2027-05-31", due24Q: "2027-05-31" },
  ];

  for (const { period, quarter, due26Q, due24Q } of TDS_QUARTERS) {
    items.push({
      id: `tds-26q-${quarter.toLowerCase()}-fy2627`,
      category: "TDS", title: "TDS Return 26Q", period,
      description: "Quarterly TDS return for payments other than salary (26Q)",
      due_date: due26Q, status: autoStatus(due26Q),
      financial_year: "2026-27", assigned_to: null,
      filed_date: null, acknowledgement_number: null,
      notes: null, is_recurring: true,
      forms: ["Form 26Q"],
      late_fee: "₹200/day under Sec 234E (max = TDS amount)",
      amount_due: null,
    });

    items.push({
      id: `tds-24q-${quarter.toLowerCase()}-fy2627`,
      category: "TDS", title: "TDS Return 24Q", period,
      description: "Quarterly TDS return for salary payments (24Q) — generates Form 16",
      due_date: due24Q, status: autoStatus(due24Q),
      financial_year: "2026-27", assigned_to: null,
      filed_date: null, acknowledgement_number: null,
      notes: null, is_recurring: true,
      forms: ["Form 24Q"],
      late_fee: "₹200/day under Sec 234E (max = TDS amount)",
      amount_due: null,
    });
  }

  // ── Quarterly TCS Returns ─────────────────────────────────────────────────
  const TCS_QUARTERS = [
    { period: "Q1 2026-27 (Apr–Jun)", quarter: "Q1", dueDate: "2026-07-15" },
    { period: "Q2 2026-27 (Jul–Sep)", quarter: "Q2", dueDate: "2026-10-15" },
    { period: "Q3 2026-27 (Oct–Dec)", quarter: "Q3", dueDate: "2027-01-15" },
    { period: "Q4 2026-27 (Jan–Mar)", quarter: "Q4", dueDate: "2027-04-15" },
  ];

  for (const { period, quarter, dueDate } of TCS_QUARTERS) {
    items.push({
      id: `tcs-return-${quarter.toLowerCase()}-fy2627`,
      category: "TCS", title: "TCS Return 27EQ", period,
      description: "Quarterly TCS return — report all collections at source",
      due_date: dueDate, status: autoStatus(dueDate),
      financial_year: "2026-27", assigned_to: null,
      filed_date: null, acknowledgement_number: null,
      notes: null, is_recurring: true,
      forms: ["Form 27EQ"],
      late_fee: "₹200/day under Sec 234E (max = TCS amount)",
      amount_due: null,
    });
  }

  // ── Advance Tax (quarterly) ────────────────────────────────────────────────
  const ADVANCE_TAX = [
    { period: "Q1 FY 2026-27", dueDate: "2026-06-15", pct: 15, amount: 1045000 },
    { period: "Q2 FY 2026-27", dueDate: "2026-09-15", pct: 45, amount: 3135000 },
    { period: "Q3 FY 2026-27", dueDate: "2026-12-15", pct: 75, amount: 5225000 },
    { period: "Q4 FY 2026-27", dueDate: "2027-03-15", pct: 100, amount: 6967000 },
  ];

  for (const { period, dueDate, pct, amount } of ADVANCE_TAX) {
    items.push({
      id: `adv-tax-${period.replace(/\s+/g, "-").toLowerCase()}`,
      category: "AdvanceTax", title: `Advance Tax — ${pct}% instalment`, period,
      description: `Pay ${pct}% of estimated annual tax liability as advance tax`,
      due_date: dueDate, status: autoStatus(dueDate),
      financial_year: "2026-27", assigned_to: null,
      filed_date: null, acknowledgement_number: null,
      notes: `Estimated total tax: ₹69.67L based on FY25-26 actuals + growth`,
      is_recurring: true,
      forms: ["Challan 280"],
      late_fee: "1% per month simple interest under Sec 234B and 234C",
      amount_due: amount,
    });
  }

  // ── FY 25-26 carry-over items due in this calendar period ──────────────────

  // TCS Q4 FY25-26 return — OVERDUE (intentional demo miss for drama)
  items.push({
    id: "tcs-q4-fy2526-return",
    category: "TCS", title: "TCS Return 27EQ", period: "Q4 FY 2025-26 (Jan–Mar)",
    description: "Quarterly TCS return for Q4 of FY 2025-26 — OVERDUE",
    due_date: "2026-05-15", status: "overdue",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "⚠️ Missed — file immediately to avoid escalating penalty",
    is_recurring: true,
    forms: ["Form 27EQ"],
    late_fee: "₹200/day under Sec 234E — ₹1,200 accrued so far (6 days)",
    amount_due: null,
  });

  // TDS Q4 FY25-26 returns — due May 31 (in 10 days)
  items.push({
    id: "tds-26q-q4-fy2526",
    category: "TDS", title: "TDS Return 26Q", period: "Q4 FY 2025-26 (Jan–Mar)",
    description: "Quarterly TDS return (non-salary) for Q4 FY 2025-26 — due May 31",
    due_date: "2026-05-31", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["Form 26Q"],
    late_fee: "₹200/day under Sec 234E",
    amount_due: null,
  });

  items.push({
    id: "tds-24q-q4-fy2526",
    category: "TDS", title: "TDS Return 24Q", period: "Q4 FY 2025-26 (Jan–Mar)",
    description: "Quarterly TDS return (salary) for Q4 FY 2025-26 — due May 31",
    due_date: "2026-05-31", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["Form 24Q"],
    late_fee: "₹200/day under Sec 234E",
    amount_due: null,
  });

  // Form 16A for FY25-26 (issued after 24Q Q4 is filed)
  items.push({
    id: "form16a-fy2526",
    category: "TDS", title: "Form 16A (TDS Certificate)", period: "FY 2025-26",
    description: "Issue TDS certificates to all deductees for FY 2025-26",
    due_date: "2026-06-15", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Issue after 24Q Q4 is filed and TRACES generates certificates",
    is_recurring: true,
    forms: ["Form 16A"],
    late_fee: "₹100/day under Sec 272A(2)(g)",
    amount_due: null,
  });

  // ── Annual items ──────────────────────────────────────────────────────────

  items.push({
    id: "gstr9-fy2526",
    category: "GST", title: "GSTR-9 (Annual Return)", period: "FY 2025-26",
    description: "Annual GST return — reconcile all monthly filings for FY 2025-26",
    due_date: "2026-12-31", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["GSTR-9"],
    late_fee: "₹200/day (max 0.25% of turnover)",
    amount_due: null,
  });

  items.push({
    id: "gstr9c-fy2526",
    category: "GST", title: "GSTR-9C (Reconciliation Statement)", period: "FY 2025-26",
    description: "GST audit reconciliation statement — certified by CA",
    due_date: "2026-12-31", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Applicable if turnover > ₹5 Cr — Robotek turnover ₹18-20 Cr applies",
    is_recurring: true,
    forms: ["GSTR-9C"],
    late_fee: "Same as GSTR-9 — ₹200/day",
    amount_due: null,
  });

  items.push({
    id: "tax-audit-fy2526",
    category: "IncomeTax", title: "Tax Audit Report (Form 3CD)", period: "FY 2025-26",
    description: "Tax audit under Sec 44AB — applicable as turnover > ₹10 Cr. CA to certify.",
    due_date: "2026-09-30", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "CA to complete before September 30 to allow time for ITR filing",
    is_recurring: true,
    forms: ["Form 3CA-3CD"],
    late_fee: "₹1.5L or 0.5% of turnover (whichever lower) under Sec 271B",
    amount_due: null,
  });

  items.push({
    id: "itr6-fy2526",
    category: "IncomeTax", title: "Income Tax Return (ITR-6)", period: "FY 2025-26",
    description: "Corporate income tax return for FY 2025-26 (Robotek India Pvt. Ltd.)",
    due_date: "2026-10-31", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "File after Tax Audit Report is uploaded and signed by CA",
    is_recurring: true,
    forms: ["ITR-6"],
    late_fee: "₹5,000 late fee under Sec 234F; prosecution risk if prolonged",
    amount_due: null,
  });

  items.push({
    id: "roc-mgt7-fy2526",
    category: "ROC", title: "ROC Annual Return (MGT-7)", period: "FY 2025-26",
    description: "Annual return with ROC — shareholding, directors, and company details",
    due_date: "2026-09-29", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Due within 60 days of AGM. AGM typically held by July 30.",
    is_recurring: true,
    forms: ["MGT-7"],
    late_fee: "₹100/day additional fee; prosecution under Sec 92(5)",
    amount_due: null,
  });

  items.push({
    id: "roc-aoc4-fy2526",
    category: "ROC", title: "ROC Financial Statements (AOC-4)", period: "FY 2025-26",
    description: "File audited financial statements with ROC within 30 days of AGM",
    due_date: "2026-09-30", status: "pending",
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "File P&L, Balance Sheet, and Auditor Report. AGM must be held by Sep 30; AOC-4 due Sep 30 (internal deadline).",
    is_recurring: true,
    forms: ["AOC-4"],
    late_fee: "₹100/day additional fee; prosecution under Sec 137(3)",
    amount_due: null,
  });

  items.push({
    id: "prof-tax-q1-fy2627",
    category: "ProfTax", title: "Professional Tax — Q1", period: "Q1 2026-27 (Apr–Jun)",
    description: "Professional Tax deposit for Haryana (₹208/month per employee drawing > ₹25K)",
    due_date: "2026-06-30", status: "pending",
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Haryana Professional Tax: ₹2,500/year deducted monthly at ₹200/month",
    is_recurring: true,
    forms: ["PT Challan (Haryana)"],
    late_fee: "Interest @18% p.a. + penalty under Haryana PT Act",
    amount_due: 1040000,
  });

  items.push({
    id: "prof-tax-q2-fy2627",
    category: "ProfTax", title: "Professional Tax — Q2", period: "Q2 2026-27 (Jul–Sep)",
    description: "Professional Tax deposit for Haryana — Q2",
    due_date: "2026-09-30", status: "pending",
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["PT Challan (Haryana)"],
    late_fee: "Interest @18% p.a. + penalty under Haryana PT Act",
    amount_due: 1040000,
  });

  items.push({
    id: "prof-tax-q3-fy2627",
    category: "ProfTax", title: "Professional Tax — Q3", period: "Q3 2026-27 (Oct–Dec)",
    description: "Professional Tax deposit for Haryana — Q3",
    due_date: "2026-12-31", status: "pending",
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["PT Challan (Haryana)"],
    late_fee: "Interest @18% p.a. + penalty under Haryana PT Act",
    amount_due: 1040000,
  });

  items.push({
    id: "prof-tax-q4-fy2627",
    category: "ProfTax", title: "Professional Tax — Q4", period: "Q4 2026-27 (Jan–Mar)",
    description: "Professional Tax deposit for Haryana — Q4",
    due_date: "2027-03-31", status: "pending",
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: null, is_recurring: true,
    forms: ["PT Challan (Haryana)"],
    late_fee: "Interest @18% p.a. + penalty under Haryana PT Act",
    amount_due: 1040000,
  });

  // ── DPT-3 (Return of Deposits) ────────────────────────────────────────────
  // Every company that has received loans/deposits (other than exempted) must
  // file DPT-3 by June 30 each year for the FY ending March 31.
  items.push({
    id: "dpt3-fy2526",
    category: "ROC", title: "DPT-3 (Return of Deposits)", period: "FY 2025-26",
    description: "Annual return of deposits/loans received — file with MCA by June 30",
    due_date: "2026-06-30", status: autoStatus("2026-06-30"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Covers all deposits/loans from members and public as of March 31, 2026. Exempted: loans from directors (with declaration), bank loans.",
    is_recurring: true,
    forms: ["DPT-3"],
    late_fee: "₹5,000 + ₹500/day after first 30 days delay",
    amount_due: null,
  });

  // ── MSME Form-1 (Half-Yearly) ──────────────────────────────────────────────
  // Companies with MSME vendors having outstanding > 45 days must file half-yearly.
  // Period Apr–Sep: due October 31 | Period Oct–Mar: due April 30
  items.push({
    id: "msme-form1-h2-fy2526",
    category: "ROC", title: "MSME Form-1 — H2 (Oct–Mar 2025-26)", period: "Oct 2025–Mar 2026",
    description: "Half-yearly return of outstanding dues to MSME suppliers (Oct 2025–Mar 2026)",
    due_date: "2026-04-30", status: autoStatus("2026-04-30"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "⚠️ Due April 30, 2026 — check if filed. Lists all MSME vendor invoices > 45 days outstanding.",
    is_recurring: true,
    forms: ["MSME Form-1"],
    late_fee: "₹25,000–₹3,00,000 (company) + ₹25,000–₹1,00,000 (officer) under MSMED Act",
    amount_due: null,
  });

  items.push({
    id: "msme-form1-h1-fy2627",
    category: "ROC", title: "MSME Form-1 — H1 (Apr–Sep 2026-27)", period: "Apr 2026–Sep 2026",
    description: "Half-yearly return of outstanding dues to MSME suppliers (Apr–Sep 2026)",
    due_date: "2026-10-31", status: autoStatus("2026-10-31"),
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Lists all MSME vendor invoices outstanding > 45 days as of September 30, 2026.",
    is_recurring: true,
    forms: ["MSME Form-1"],
    late_fee: "₹25,000–₹3,00,000 (company) + ₹25,000–₹1,00,000 (officer) under MSMED Act",
    amount_due: null,
  });

  items.push({
    id: "msme-form1-h2-fy2627",
    category: "ROC", title: "MSME Form-1 — H2 (Oct 2026–Mar 2027)", period: "Oct 2026–Mar 2027",
    description: "Half-yearly return of outstanding dues to MSME suppliers (Oct 2026–Mar 2027)",
    due_date: "2027-04-30", status: autoStatus("2027-04-30"),
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Lists all MSME vendor invoices outstanding > 45 days as of March 31, 2027.",
    is_recurring: true,
    forms: ["MSME Form-1"],
    late_fee: "₹25,000–₹3,00,000 (company) + ₹25,000–₹1,00,000 (officer) under MSMED Act",
    amount_due: null,
  });

  // ── LLP Form-11 (Annual Return) ────────────────────────────────────────────
  // Due within 60 days of close of FY (March 31) = May 30 each year.
  // ⚠️ URGENT: FY 2025-26 Form-11 is due May 30, 2026 — only 5 days away!
  items.push({
    id: "llp-form11-fy2526",
    category: "ROC", title: "LLP Form-11 (Annual Return)", period: "FY 2025-26",
    description: "LLP Annual Return — details of partners, contributions, and LLP agreement changes",
    due_date: "2026-05-30", status: autoStatus("2026-05-30"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "⚠️ URGENT — due May 30, 2026 (within 60 days of March 31). File immediately.",
    is_recurring: true,
    forms: ["LLP Form-11"],
    late_fee: "₹100/day per day of delay — no cap. Accumulates rapidly.",
    amount_due: null,
  });

  items.push({
    id: "llp-form11-fy2627",
    category: "ROC", title: "LLP Form-11 (Annual Return)", period: "FY 2026-27",
    description: "LLP Annual Return — details of partners, contributions, and LLP agreement changes",
    due_date: "2027-05-30", status: autoStatus("2027-05-30"),
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Due within 60 days of March 31, 2027 = May 30, 2027.",
    is_recurring: true,
    forms: ["LLP Form-11"],
    late_fee: "₹100/day per day of delay — no cap.",
    amount_due: null,
  });

  // ── LLP Form-8 (Statement of Account & Solvency) ──────────────────────────
  // Due within 30 days from end of first 6 months of FY (Sep 30) = Oct 30 each year.
  items.push({
    id: "llp-form8-fy2526",
    category: "ROC", title: "LLP Form-8 (Statement of Solvency)", period: "FY 2025-26 H1",
    description: "LLP Statement of Account & Solvency — certify financial position signed by designated partners + CA",
    due_date: "2025-10-30", status: autoStatus("2025-10-30"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Due within 30 days from September 30 (end of first 6 months of FY). Check if filed for FY 2025-26.",
    is_recurring: true,
    forms: ["LLP Form-8"],
    late_fee: "₹100/day per day of delay.",
    amount_due: null,
  });

  items.push({
    id: "llp-form8-fy2627",
    category: "ROC", title: "LLP Form-8 (Statement of Solvency)", period: "FY 2026-27 H1",
    description: "LLP Statement of Account & Solvency — certify financial position for first half of FY 2026-27",
    due_date: "2026-10-30", status: autoStatus("2026-10-30"),
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Due October 30, 2026 (30 days after September 30 end of first 6 months). CA certification required.",
    is_recurring: true,
    forms: ["LLP Form-8"],
    late_fee: "₹100/day per day of delay.",
    amount_due: null,
  });

  // ── DIN KYC (DIR-3 KYC) ───────────────────────────────────────────────────
  // Every director who has been allotted a DIN must file KYC by September 30 each year.
  items.push({
    id: "din-kyc-fy2627",
    category: "ROC", title: "DIN KYC — All Directors (DIR-3 KYC)", period: "FY 2026-27",
    description: "Annual KYC of Directors — every DIN holder must file DIR-3 KYC by September 30",
    due_date: "2026-09-30", status: autoStatus("2026-09-30"),
    financial_year: "2026-27", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "All directors of Robotek India must file separately. Requires OTP on registered mobile + email. DIN is deactivated if KYC is missed.",
    is_recurring: true,
    forms: ["DIR-3 KYC (Web)"],
    late_fee: "₹5,000 reactivation fee per DIN if filed after September 30",
    amount_due: null,
  });

  // ── GSTR-9 & 9C — Entity-Specific ────────────────────────────────────────
  // FY 2025-26 annual returns for LLP and other group entities.
  // Update existing gstr9-fy2526 note to clarify it's for Robotek India Pvt Ltd.
  items.push({
    id: "gstr9-robotek-llp-fy2526",
    category: "GST", title: "GSTR-9 & 9C — Robotek LLP", period: "FY 2025-26",
    description: "Annual GST return (GSTR-9) + Reconciliation Statement (GSTR-9C) for Robotek LLP for FY 2025-26",
    due_date: "2026-12-31", status: autoStatus("2026-12-31"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Entity: Robotek LLP. Turnover determines applicability of 9C. CA to certify GSTR-9C if turnover > ₹5 Cr.",
    is_recurring: true,
    forms: ["GSTR-9", "GSTR-9C"],
    late_fee: "₹200/day (max 0.25% of turnover) — per entity separately",
    amount_due: null,
  });

  items.push({
    id: "gstr9-muskan-towers-fy2526",
    category: "GST", title: "GSTR-9 — Muskan Towers Pvt Ltd", period: "FY 2025-26",
    description: "Annual GST return (GSTR-9) for Muskan Towers Pvt Ltd for FY 2025-26",
    due_date: "2026-12-31", status: autoStatus("2026-12-31"),
    financial_year: "2025-26", assigned_to: null,
    filed_date: null, acknowledgement_number: null,
    notes: "Entity: Muskan Towers Pvt Ltd. Reconcile all monthly GSTR-1 and GSTR-3B filings for FY 2025-26.",
    is_recurring: true,
    forms: ["GSTR-9"],
    late_fee: "₹200/day (max 0.25% of turnover)",
    amount_due: null,
  });

  return items;
}

// ─── Exported constants ───────────────────────────────────────────────────────

/** All compliance items for FY 2026-27 (+ FY25-26 carry-overs due this period). */
export const COMPLIANCE_ITEMS: ComplianceItem[] = generateItems();

/** All category IDs in display order. */
export const ALL_CATEGORIES: ComplianceCategoryId[] = [
  "GST", "TDS", "TCS", "PF", "ESI", "AdvanceTax", "ROC", "IncomeTax", "ProfTax",
];

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Returns all items whose due_date falls in the given calendar year+month. */
export function getItemsForMonth(
  items: ComplianceItem[],
  year: number,
  month: number,
): ComplianceItem[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return items.filter((i) => i.due_date.startsWith(prefix));
}

/** Compliance score: % of past-due items that were filed/paid on time. */
export function computeComplianceScore(
  items: ComplianceItem[],
  asOfDate: string = TODAY,
): number {
  const pastDue = items.filter((i) => i.due_date <= asOfDate);
  if (pastDue.length === 0) return 100;
  const completed = pastDue.filter((i) => i.status === "filed" || i.status === "paid").length;
  return Math.round((completed / pastDue.length) * 100);
}

/** How many days overdue or days until due (negative = overdue). */
export function daysFromToday(dueDate: string, today: string = TODAY): number {
  const msPerDay = 86_400_000;
  return Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / msPerDay);
}

/** Format a YYYY-MM-DD date as "11 May 2026". */
export function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
