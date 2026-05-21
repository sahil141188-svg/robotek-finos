/**
 * Tasks Sample Data — Module 4: Task Management
 *
 * Realistic tasks for Robotek India finance team (today = 2026-05-21).
 * In production, all data comes from Supabase `tasks` table.
 */

export type TaskStatus   = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskModule   = "compliance" | "payables" | "receivables" | "import" | "review" | "general";

export type SampleTask = {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string;        // display name for demo
  assigned_to_role: string;   // ceo | cfo | accounts | ca
  assigned_by: string;
  due_date: string | null;    // YYYY-MM-DD
  completed_at: string | null;
  compliance_item_id: string | null;
  module: TaskModule;
  created_at: string;
  updated_at: string;
  tags: string[];
};

export type TaskActivity = {
  actor: string;
  action: string;
  timestamp: string;
  note?: string;
};

const TODAY = "2026-05-21";

export const SAMPLE_TASKS: SampleTask[] = [
  {
    id: "task-001",
    title: "File TCS Return 27EQ — Q4 FY25-26 (OVERDUE)",
    description:
      "The quarterly TCS return (Form 27EQ) for Jan–Mar 2026 was due on 15 May 2026 and is now 6 days overdue. " +
      "Penalty is accruing at ₹200/day. File immediately to cap the penalty at ₹1,200.",
    status: "overdue",
    priority: "urgent",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-05-15",
    completed_at: null,
    compliance_item_id: "tcs-q4-fy2526-return",
    module: "compliance",
    created_at: "2026-05-01T09:00:00Z",
    updated_at: TODAY + "T00:00:00Z",
    tags: ["TCS", "Overdue", "Urgent"],
  },
  {
    id: "task-002",
    title: "Vendor payment batch — May outstanding",
    description:
      "Process payment run for 8 vendors with outstanding invoices beyond payment terms. " +
      "Total: ₹34.2L. Requires CFO approval for amounts > ₹5L. " +
      "Priority vendors: Kundli Polymers, Delhi Sheet Metal, RK Components.",
    status: "in_progress",
    priority: "high",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "Sahil Aggarwal (CEO)",
    due_date: "2026-05-25",
    completed_at: null,
    compliance_item_id: null,
    module: "payables",
    created_at: "2026-05-18T10:30:00Z",
    updated_at: TODAY + "T00:00:00Z",
    tags: ["Payables", "Payment Run"],
  },
  {
    id: "task-003",
    title: "TDS Return 26Q — Q4 FY25-26 filing",
    description:
      "File Form 26Q (non-salary TDS return) for Q4 FY 2025-26. " +
      "Due May 31, 2026 — 10 days remaining. " +
      "Ensure all deductee PAN numbers are validated in TRACES before filing.",
    status: "pending",
    priority: "high",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-05-31",
    completed_at: null,
    compliance_item_id: "tds-26q-q4-fy2526",
    module: "compliance",
    created_at: "2026-05-19T09:00:00Z",
    updated_at: "2026-05-19T09:00:00Z",
    tags: ["TDS", "26Q"],
  },
  {
    id: "task-004",
    title: "TDS Return 24Q — Q4 FY25-26 filing",
    description:
      "File Form 24Q (salary TDS return) for Q4 FY 2025-26. " +
      "Due May 31, 2026. Required to generate Form 16 for employees.",
    status: "pending",
    priority: "high",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-05-31",
    completed_at: null,
    compliance_item_id: "tds-24q-q4-fy2526",
    module: "compliance",
    created_at: "2026-05-19T09:00:00Z",
    updated_at: "2026-05-19T09:00:00Z",
    tags: ["TDS", "24Q", "Salary"],
  },
  {
    id: "task-005",
    title: "Customer follow-up — ABC Electronics ₹18.4L overdue",
    description:
      "ABC Electronics has ₹18.4L outstanding beyond 60 days (invoices Apr 2026). " +
      "Escalate to senior management contact. Collect PDC or initiate legal notice process " +
      "if no commitment received by May 28.",
    status: "pending",
    priority: "urgent",
    assigned_to: "Amit Verma",
    assigned_to_role: "accounts",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-05-28",
    completed_at: null,
    compliance_item_id: null,
    module: "receivables",
    created_at: "2026-05-15T14:00:00Z",
    updated_at: "2026-05-15T14:00:00Z",
    tags: ["AR", "Overdue Collection", "ABC Electronics"],
  },
  {
    id: "task-006",
    title: "Advance tax Q1 — calculation and deposit",
    description:
      "Calculate Q1 advance tax liability (15% of estimated annual tax). " +
      "Due June 15, 2026. Last year total was ₹69.67L; " +
      "adjust upward 15% for FY26-27 growth. Prepare challan and obtain CFO sign-off.",
    status: "pending",
    priority: "high",
    assigned_to: "CA Suresh Bansal",
    assigned_to_role: "ca",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-06-15",
    completed_at: null,
    compliance_item_id: "adv-tax-q1-fy-2026-27",
    module: "compliance",
    created_at: "2026-05-20T09:00:00Z",
    updated_at: "2026-05-20T09:00:00Z",
    tags: ["Advance Tax", "Q1"],
  },
  {
    id: "task-007",
    title: "Form 16A — TDS certificates for FY25-26",
    description:
      "After 26Q Q4 is filed and processed by TRACES, download and issue Form 16A " +
      "certificates to all vendors/deductees. Due June 15. " +
      "Coordinate with accounts for deductee email addresses.",
    status: "pending",
    priority: "medium",
    assigned_to: "CA Suresh Bansal",
    assigned_to_role: "ca",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-06-15",
    completed_at: null,
    compliance_item_id: "form16a-fy2526",
    module: "compliance",
    created_at: "2026-05-20T09:00:00Z",
    updated_at: "2026-05-20T09:00:00Z",
    tags: ["TDS", "Form 16A"],
  },
  {
    id: "task-008",
    title: "GSTR-1 May 2026 — preparation",
    description:
      "Compile all May 2026 sales invoices and prepare GSTR-1 draft. " +
      "Due June 11, 2026. Ensure B2B invoices have correct GSTINs, " +
      "e-invoices are generated for invoices > ₹5L, and RCM entries are correct.",
    status: "pending",
    priority: "medium",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "Rajesh Kumar (CFO)",
    due_date: "2026-06-08",
    completed_at: null,
    compliance_item_id: "gstr1-may-2026",
    module: "compliance",
    created_at: "2026-05-20T09:00:00Z",
    updated_at: "2026-05-20T09:00:00Z",
    tags: ["GST", "GSTR-1"],
  },
  {
    id: "task-009",
    title: "Board meeting — Q1 FY26-27 financial presentation",
    description:
      "Prepare CFO presentation for June board meeting. " +
      "Include: P&L vs budget, cash position, AP/AR aging, compliance status, " +
      "advance tax Q1 payment, and FY forecast. Deadline: June 10 for board pack distribution.",
    status: "pending",
    priority: "high",
    assigned_to: "Rajesh Kumar",
    assigned_to_role: "cfo",
    assigned_by: "Sahil Aggarwal (CEO)",
    due_date: "2026-06-10",
    completed_at: null,
    compliance_item_id: null,
    module: "review",
    created_at: "2026-05-17T11:00:00Z",
    updated_at: "2026-05-17T11:00:00Z",
    tags: ["Board", "Review", "Presentation"],
  },
  {
    id: "task-010",
    title: "PF / ESI reconciliation — May 2026",
    description:
      "Reconcile PF and ESI contributions for May. " +
      "Employee headcount: 512. Verify new joiners (3) and exits (1). " +
      "ECR to be filed and challan payment by June 15.",
    status: "pending",
    priority: "medium",
    assigned_to: "Amit Verma",
    assigned_to_role: "accounts",
    assigned_by: "Priya Sharma",
    due_date: "2026-06-10",
    completed_at: null,
    compliance_item_id: "pf-deposit-may-2026",
    module: "compliance",
    created_at: "2026-05-21T09:00:00Z",
    updated_at: TODAY + "T09:00:00Z",
    tags: ["PF", "ESI", "Payroll"],
  },
  {
    id: "task-011",
    title: "Tax audit document collection — FY25-26",
    description:
      "Compile all documents required for tax audit under Sec 44AB. " +
      "Required: P&L, Balance Sheet, bank statements (all accounts), " +
      "fixed asset register, all contracts > ₹50L, TDS certificates. " +
      "Target: hand over to CA by August 1.",
    status: "pending",
    priority: "medium",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "CA Suresh Bansal",
    due_date: "2026-08-01",
    completed_at: null,
    compliance_item_id: "tax-audit-fy2526",
    module: "compliance",
    created_at: "2026-05-10T10:00:00Z",
    updated_at: "2026-05-10T10:00:00Z",
    tags: ["Tax Audit", "Annual"],
  },
  {
    id: "task-012",
    title: "ROC annual compliance — AOC-4 document preparation",
    description:
      "Prepare financial statements in prescribed format for AOC-4 filing. " +
      "Audited FS required. Target AGM by July 30, filing within 30 days. " +
      "Coordinate with statutory auditor for signed balance sheet.",
    status: "pending",
    priority: "medium",
    assigned_to: "CA Suresh Bansal",
    assigned_to_role: "ca",
    assigned_by: "Sahil Aggarwal (CEO)",
    due_date: "2026-07-15",
    completed_at: null,
    compliance_item_id: "roc-aoc4-fy2526",
    module: "compliance",
    created_at: "2026-05-10T10:00:00Z",
    updated_at: "2026-05-10T10:00:00Z",
    tags: ["ROC", "Annual", "AOC-4"],
  },
  {
    id: "task-013",
    title: "Customer aging review — Q1 FY26-27",
    description:
      "Prepare complete AR aging report as of June 30, 2026. " +
      "Flag all accounts > 60 days for CFO review. " +
      "Compute DSO and compare with Q4 FY25-26 (target: improve from 47 to 42 days).",
    status: "pending",
    priority: "medium",
    assigned_to: "Rajesh Kumar",
    assigned_to_role: "cfo",
    assigned_by: "Sahil Aggarwal (CEO)",
    due_date: "2026-07-05",
    completed_at: null,
    compliance_item_id: null,
    module: "receivables",
    created_at: "2026-05-21T09:00:00Z",
    updated_at: TODAY + "T09:00:00Z",
    tags: ["AR", "Aging", "DSO"],
  },
  {
    id: "task-014",
    title: "GSTR-3B April 2026 — reconcile ITC with GSTR-2B",
    description:
      "Verify that GSTR-3B filed on May 20 matches GSTR-2B exactly. " +
      "Any excess ITC claimed must be reversed with 18% interest. " +
      "Reconciliation report to be archived.",
    status: "completed",
    priority: "high",
    assigned_to: "Priya Sharma",
    assigned_to_role: "accounts",
    assigned_by: "CA Suresh Bansal",
    due_date: "2026-05-22",
    completed_at: "2026-05-20T17:30:00Z",
    compliance_item_id: "gstr3b-apr-2026",
    module: "compliance",
    created_at: "2026-05-14T09:00:00Z",
    updated_at: "2026-05-20T17:30:00Z",
    tags: ["GST", "ITC", "Reconciliation"],
  },
  {
    id: "task-015",
    title: "PF deposit — April 2026 ECR filing",
    description: "ECR filed and PF challan paid for April 2026. 511 employees. Total: ₹18.4L.",
    status: "completed",
    priority: "medium",
    assigned_to: "Amit Verma",
    assigned_to_role: "accounts",
    assigned_by: "Priya Sharma",
    due_date: "2026-05-15",
    completed_at: "2026-05-15T11:00:00Z",
    compliance_item_id: "pf-deposit-apr-2026",
    module: "compliance",
    created_at: "2026-05-12T09:00:00Z",
    updated_at: "2026-05-15T11:00:00Z",
    tags: ["PF", "Payroll"],
  },
];

// ─── Activity logs (per task, for detail page) ────────────────────────────────

export const TASK_ACTIVITIES: Record<string, TaskActivity[]> = {
  "task-001": [
    { actor: "System",             action: "Task created",                   timestamp: "2026-05-01T09:00:00Z" },
    { actor: "Rajesh Kumar (CFO)", action: "Assigned to Priya Sharma",       timestamp: "2026-05-01T09:00:00Z" },
    { actor: "System",             action: "Reminder sent (7 days before)",  timestamp: "2026-05-08T09:00:00Z" },
    { actor: "System",             action: "Reminder sent (3 days before)",  timestamp: "2026-05-12T09:00:00Z" },
    { actor: "System",             action: "Reminder sent (1 day before)",   timestamp: "2026-05-14T09:00:00Z" },
    { actor: "System",             action: "Task marked OVERDUE",            timestamp: "2026-05-16T00:00:00Z" },
    { actor: "System",             action: "Escalation: notified CFO",       timestamp: "2026-05-17T00:00:00Z", note: "Escalated after 24 hours without action" },
  ],
  "task-002": [
    { actor: "Sahil Aggarwal (CEO)", action: "Task created", timestamp: "2026-05-18T10:30:00Z" },
    { actor: "Priya Sharma",         action: "Marked in progress", timestamp: "2026-05-19T09:00:00Z" },
    { actor: "Priya Sharma",         action: "Note: 3 vendors paid — 5 remaining", timestamp: "2026-05-20T15:00:00Z" },
  ],
  "task-014": [
    { actor: "CA Suresh Bansal",   action: "Task created",                   timestamp: "2026-05-14T09:00:00Z" },
    { actor: "Priya Sharma",       action: "Marked in progress",             timestamp: "2026-05-19T10:00:00Z" },
    { actor: "Priya Sharma",       action: "Marked complete — ITC matches GSTR-2B exactly", timestamp: "2026-05-20T17:30:00Z" },
  ],
  "task-015": [
    { actor: "System",        action: "Task created",            timestamp: "2026-05-12T09:00:00Z" },
    { actor: "Amit Verma",    action: "ECR filed on EPFO portal", timestamp: "2026-05-15T10:30:00Z" },
    { actor: "Amit Verma",    action: "Marked complete",          timestamp: "2026-05-15T11:00:00Z" },
  ],
};

// ─── Helper constants ─────────────────────────────────────────────────────────

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string; dot: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 border-red-200",    dot: "bg-red-500" },
  high:   { label: "High",   className: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-500" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-500" },
  low:    { label: "Low",    className: "bg-gray-100 text-gray-700 border-gray-200",  dot: "bg-gray-400" },
};

export const STATUS_META: Record<TaskStatus, { label: string; className: string }> = {
  pending:     { label: "Pending",     className: "bg-blue-100 text-blue-800 border-blue-200" },
  in_progress: { label: "In Progress", className: "bg-purple-100 text-purple-800 border-purple-200" },
  completed:   { label: "Completed",   className: "bg-green-100 text-green-800 border-green-200" },
  overdue:     { label: "Overdue",     className: "bg-red-100 text-red-800 border-red-200" },
  cancelled:   { label: "Cancelled",   className: "bg-gray-100 text-gray-600 border-gray-200" },
};

export const MODULE_LABELS: Record<TaskModule, string> = {
  compliance:  "Compliance",
  payables:    "Accounts Payable",
  receivables: "Accounts Receivable",
  import:      "Data Import",
  review:      "Review Engine",
  general:     "General",
};

export const ROLE_LABELS: Record<string, { label: string; initials: string; color: string }> = {
  ceo:      { label: "CEO",       initials: "SA", color: "bg-brand-red text-white" },
  cfo:      { label: "CFO",       initials: "RK", color: "bg-purple-600 text-white" },
  accounts: { label: "Accounts",  initials: "PS", color: "bg-blue-600 text-white" },
  ca:       { label: "CA",        initials: "CB", color: "bg-teal-600 text-white" },
};

/** Human-readable relative date ("3 days left", "2 days overdue", "No due date") */
export function relativeDate(dueDate: string | null, today: string = TODAY): string {
  if (!dueDate) return "No due date";
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / msPerDay);
  if (days < 0)  return `${Math.abs(days)} day${Math.abs(days) > 1 ? "s" : ""} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

/** Format YYYY-MM-DD as "21 May 2026" */
export function fmtTaskDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/** Format ISO datetime as "20 May 2026, 5:30 PM" */
export function fmtTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Derive effective status: if status = pending and due date is past, show as overdue */
export function effectiveStatus(task: SampleTask, today: string = TODAY): TaskStatus {
  if (task.status === "pending" && task.due_date && task.due_date < today) return "overdue";
  return task.status;
}
