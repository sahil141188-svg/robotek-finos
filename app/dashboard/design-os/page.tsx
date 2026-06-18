/**
 * Design OS — Overview
 * Shows all design tasks with their current status in the flow.
 */

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { TaskCard } from "@/components/design-os/task-card";
import { getDesignTasks } from "@/app/actions/design-os";
import { requireAuth } from "@/lib/auth";
import { Plus, Palette, CheckCircle2, RefreshCw, Hourglass, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_ORDER = ["no_submission", "needs_correction", "pending_review", "approved", "final_approved", "rejected"];

export default async function DesignOsPage() {
  await requireAuth();
  const tasks = await getDesignTasks();

  const counts = {
    total:         tasks.length,
    pending:       tasks.filter((t) => !t.latest_submission || t.latest_submission.status === "pending_review").length,
    correction:    tasks.filter((t) => t.latest_submission?.status === "needs_correction").length,
    approved:      tasks.filter((t) => t.latest_submission?.status === "approved").length,
    finalApproved: tasks.filter((t) => t.latest_submission?.status === "final_approved").length,
  };

  // Sort tasks: corrections first, then pending, then others
  const sorted = [...tasks].sort((a, b) => {
    const sa = a.latest_submission?.status ?? "no_submission";
    const sb = b.latest_submission?.status ?? "no_submission";
    return STATUS_ORDER.indexOf(sa) - STATUS_ORDER.indexOf(sb);
  });

  return (
    <>
      <Header
        title="Design OS"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Design OS" }]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-5xl">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiTile icon={<Palette className="w-5 h-5 text-blue-600" />}  label="Total Tasks"     value={counts.total} />
          <KpiTile icon={<Hourglass className="w-5 h-5 text-amber-500" />} label="Under Review"  value={counts.pending} color="text-amber-600" />
          <KpiTile icon={<RefreshCw className="w-5 h-5 text-red-500" />}   label="Need Correction" value={counts.correction} color="text-red-600" />
          <KpiTile icon={<Trophy className="w-5 h-5 text-green-500" />}    label="Final Approved" value={counts.finalApproved} color="text-green-600" />
        </div>

        {/* Flow diagram strip */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Design Flow</p>
          <div className="flex items-center gap-1 flex-wrap text-xs">
            {[
              { label: "1. Assign Task", who: "Management", color: "bg-teal-100 text-teal-700" },
              { label: "2. Make Design", who: "Vishal / Nitin", color: "bg-orange-100 text-orange-700" },
              { label: "3. Review", who: "Sarthak (4 hrs)", color: "bg-blue-100 text-blue-700" },
              { label: "4. Share / Correct", who: "Vishal / Nitin", color: "bg-orange-100 text-orange-700" },
              { label: "5. Final Approval", who: "Management", color: "bg-green-100 text-green-700" },
            ].map((step, i, arr) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`rounded-lg px-2.5 py-1.5 ${step.color}`}>
                  <p className="font-semibold">{step.label}</p>
                  <p className="opacity-70">{step.who}</p>
                </div>
                {i < arr.length - 1 && <span className="text-gray-400">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Assign Task button */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">All Tasks</h2>
          <Link
            href="/dashboard/design-os/tasks/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Assign Task
          </Link>
        </div>

        {/* Task list */}
        {sorted.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Palette className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">No design tasks yet</p>
            <p className="text-sm text-gray-500 mt-1">Assign the first task to get started.</p>
            <Link
              href="/dashboard/design-os/tasks/new"
              className="inline-flex items-center gap-2 mt-4 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Assign Task
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sorted.map((task) => (
              <TaskCard
                key={task.id}
                id={task.id}
                title={task.title}
                task_type={task.task_type}
                platform={task.platform}
                assigned_to={task.assigned_to}
                deadline={task.deadline}
                priority={task.priority}
                status={(task.latest_submission?.status as never) ?? null}
                round={task.latest_submission?.round}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function KpiTile({
  icon, label, value, color = "text-gray-900"
}: {
  icon: React.ReactNode; label: string; value: number; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
