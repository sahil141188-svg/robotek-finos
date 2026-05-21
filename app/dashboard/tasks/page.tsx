import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { CheckSquare, Circle } from "lucide-react";

const SAMPLE_TASKS = [
  { title: "File GSTR-1 for May",        assignee: "Accounts",  due: "11 Jun", priority: "high",   status: "pending" },
  { title: "Deposit TDS for May",         assignee: "Accounts",  due: "7 Jun",  priority: "urgent", status: "pending" },
  { title: "Reconcile ITC for April",     assignee: "CA",        due: "15 Jun", priority: "medium", status: "pending" },
  { title: "Upload PF challans",          assignee: "Accounts",  due: "15 Jun", priority: "medium", status: "pending" },
  { title: "Review vendor aging report",  assignee: "CFO",       due: "5 Jun",  priority: "low",    status: "pending" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-100 text-red-700",
  high:   "bg-orange-100 text-orange-700",
  medium: "bg-yellow-100 text-yellow-700",
  low:    "bg-gray-100 text-gray-600",
};

export default async function TasksPage() {
  await requireAuth();

  return (
    <>
      <Header
        title="Task Management"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Task Management" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6">

        <div className="flex items-start gap-3 bg-brand-yellow/20 border border-brand-yellow/40 rounded-xl p-4">
          <CheckSquare className="w-5 h-5 text-brand-maroon mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-brand-black">Full Task Engine — coming on Day 6</p>
            <p className="text-xs text-brand-gray-mid mt-0.5">
              Assign tasks, set deadlines, send reminders, escalate to next role if not actioned within 24 hours.
              Full audit trail on every task action.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-brand-gray-light">
            <p className="text-sm font-semibold text-brand-black">Upcoming Tasks</p>
            <span className="text-xs text-brand-gray-mid">{SAMPLE_TASKS.length} tasks</span>
          </div>
          <ul className="divide-y divide-border">
            {SAMPLE_TASKS.map((task) => (
              <li key={task.title} className="flex items-center gap-3 px-4 py-3">
                <Circle className="w-4 h-4 text-brand-gray-mid shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-brand-black truncate">{task.title}</p>
                  <p className="text-xs text-brand-gray-mid">Assigned to {task.assignee} · Due {task.due}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>
                  {task.priority}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </main>
    </>
  );
}
