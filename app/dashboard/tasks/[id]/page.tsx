/**
 * Task Detail Page — Module 4
 *
 * Shows full task details, activity log, and status update actions.
 * Implements RULE 10: audit trail on all actions.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { TaskDetailActions } from "@/components/tasks/task-detail-actions";
import {
  SAMPLE_TASKS, TASK_ACTIVITIES,
  STATUS_META, MODULE_LABELS, ROLE_LABELS,
  fmtTaskDate, fmtTimestamp, effectiveStatus, relativeDate,
} from "@/lib/tasks-data";
import {
  ArrowLeft, Calendar, Tag, User, Clock,
  Link2, AlertTriangle, CheckCircle2,
} from "lucide-react";

export async function generateStaticParams() {
  return SAMPLE_TASKS.map((t) => ({ id: t.id }));
}

const TODAY = "2026-05-21";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const task = SAMPLE_TASKS.find((t) => t.id === id);
  if (!task) notFound();

  const eff       = effectiveStatus(task, TODAY);
  const rel       = relativeDate(task.due_date, TODAY);
  const statusMeta = STATUS_META[eff];
  const roleInfo  = ROLE_LABELS[task.assigned_to_role] ?? { initials: "?", color: "bg-gray-400 text-white", label: "" };
  const activities = TASK_ACTIVITIES[task.id] ?? [];
  const isDone    = task.status === "completed" || task.status === "cancelled";

  return (
    <>
      <Header
        title={task.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks",     href: "/dashboard/tasks" },
          { label: task.title.substring(0, 40) + (task.title.length > 40 ? "…" : "") },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 max-w-3xl space-y-5">

        <Link
          href="/dashboard/tasks"
          className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-border p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge priority={task.priority} showDot />
            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
            {task.module !== "general" && (
              <span className="text-xs px-2 py-0.5 rounded-full border border-border bg-brand-gray-light text-brand-gray-mid font-medium flex items-center gap-1">
                <Tag className="w-3 h-3" /> {MODULE_LABELS[task.module]}
              </span>
            )}
          </div>

          <h1 className="text-lg font-bold text-brand-black leading-snug">{task.title}</h1>
          {task.description && (
            <p className="text-sm text-brand-gray-mid leading-relaxed">{task.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-border">
            <MetaTile
              icon={<User className="w-3.5 h-3.5 text-brand-red" />}
              label="Assigned To"
            >
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${roleInfo.color}`}>
                  {roleInfo.initials}
                </span>
                <span className="text-sm font-medium text-brand-black truncate">{task.assigned_to}</span>
              </div>
            </MetaTile>

            <MetaTile
              icon={<Calendar className="w-3.5 h-3.5 text-brand-red" />}
              label="Due Date"
            >
              <p className="text-sm font-semibold text-brand-black">{fmtTaskDate(task.due_date)}</p>
              {!isDone && task.due_date && (
                <p className={`text-[10px] font-medium mt-0.5 ${
                  eff === "overdue" ? "text-red-600" : "text-brand-gray-mid"
                }`}>{rel}</p>
              )}
            </MetaTile>

            <MetaTile
              icon={<User className="w-3.5 h-3.5 text-brand-red" />}
              label="Assigned By"
            >
              <p className="text-sm font-semibold text-brand-black">{task.assigned_by}</p>
            </MetaTile>

            <MetaTile
              icon={<Clock className="w-3.5 h-3.5 text-brand-red" />}
              label="Created"
            >
              <p className="text-sm font-semibold text-brand-black">{fmtTaskDate(task.created_at.split("T")[0])}</p>
            </MetaTile>
          </div>
        </div>

        {/* Overdue warning */}
        {eff === "overdue" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">This task is overdue</p>
              <p className="text-xs text-red-700 mt-0.5">
                Was due {fmtTaskDate(task.due_date!)} · {Math.abs(
                  Math.round((new Date(task.due_date!).getTime() - new Date(TODAY).getTime()) / 86_400_000)
                )} days overdue · CFO has been notified.
              </p>
            </div>
          </div>
        )}

        {/* Completed info */}
        {task.status === "completed" && task.completed_at && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800">Task completed</p>
              <p className="text-xs text-green-700 mt-0.5">{fmtTimestamp(task.completed_at)}</p>
            </div>
          </div>
        )}

        {/* Linked compliance item */}
        {task.compliance_item_id && (
          <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3">
            <Link2 className="w-4 h-4 text-brand-gray-mid shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium text-brand-gray-mid uppercase tracking-wide mb-0.5">
                Linked Compliance Item
              </p>
              <Link
                href={`/dashboard/compliance/${task.compliance_item_id}`}
                className="text-sm font-semibold text-brand-red hover:underline"
              >
                View in Compliance Calendar →
              </Link>
            </div>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {task.tags.map((tag) => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full border border-border bg-brand-gray-light text-brand-gray-mid font-medium">
                # {tag}
              </span>
            ))}
          </div>
        )}

        {/* Status update */}
        {!isDone && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-4">Update Status</h3>
            <TaskDetailActions task={task} />
          </div>
        )}

        {/* Activity log */}
        {activities.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold text-brand-black mb-4">Activity Log</h3>
            <div className="space-y-3">
              {activities.map((act, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2 h-2 rounded-full bg-brand-red mt-1.5 shrink-0" />
                    {i < activities.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-3">
                    <p className="text-sm text-brand-black">
                      <span className="font-medium">{act.actor}</span>
                      {" — "}
                      {act.action}
                    </p>
                    {act.note && (
                      <p className="text-xs text-brand-gray-mid mt-0.5 italic">{act.note}</p>
                    )}
                    <p className="text-[10px] text-brand-gray-mid mt-0.5">{fmtTimestamp(act.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function MetaTile({ icon, label, children }: {
  icon: React.ReactNode; label: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        {icon}
        <span className="text-[10px] font-medium text-brand-gray-mid uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </div>
  );
}
