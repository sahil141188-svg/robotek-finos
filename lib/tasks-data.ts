/**
 * Tasks — Types and Utilities
 * Sample data removed. Tasks come from Supabase `tasks` table.
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
  assigned_to: string;
  assigned_to_role: string;
  assigned_by: string;
  due_date: string | null;
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

const TODAY = new Date().toISOString().slice(0, 10);

// Empty — populated from real Supabase tasks table
export const SAMPLE_TASKS: SampleTask[] = [];
export const TASK_ACTIVITIES: Record<string, TaskActivity[]> = {};

// ─── Helper constants (keep these — used by UI components) ────────────────────

export const PRIORITY_META: Record<TaskPriority, { label: string; className: string; dot: string }> = {
  urgent: { label: "Urgent", className: "bg-red-100 text-red-800 border-red-200",           dot: "bg-red-500" },
  high:   { label: "High",   className: "bg-orange-100 text-orange-800 border-orange-200",  dot: "bg-orange-500" },
  medium: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-200",  dot: "bg-yellow-500" },
  low:    { label: "Low",    className: "bg-gray-100 text-gray-700 border-gray-200",        dot: "bg-gray-400" },
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
  ceo:      { label: "CEO",      initials: "SA", color: "bg-brand-red text-white" },
  cfo:      { label: "CFO",      initials: "RK", color: "bg-purple-600 text-white" },
  accounts: { label: "Accounts", initials: "PS", color: "bg-blue-600 text-white" },
  ca:       { label: "CA",       initials: "CB", color: "bg-teal-600 text-white" },
};

/** Human-readable relative date ("3 days left", "2 days overdue") */
export function relativeDate(dueDate: string | null, today: string = TODAY): string {
  if (!dueDate) return "No due date";
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / msPerDay);
  if (days < 0)   return `${Math.abs(days)} day${Math.abs(days) > 1 ? "s" : ""} overdue`;
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

/** Derive effective status: pending + past due date → overdue */
export function effectiveStatus(task: SampleTask, today: string = TODAY): TaskStatus {
  if (task.status === "pending" && task.due_date && task.due_date < today) return "overdue";
  return task.status;
}
