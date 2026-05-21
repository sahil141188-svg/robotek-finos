"use client";

/**
 * TaskContent — interactive task list.
 * Grouped: Overdue → In Progress → Due This Week → Upcoming → Completed
 * Filter by: All | My Tasks (accounts) | Priority | Module
 * Quick actions: Start, Complete, Escalate
 */

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle, Clock, CheckCircle2, PlayCircle,
  ArrowUpCircle, ChevronDown, ChevronUp, Plus,
  Calendar, Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityBadge } from "@/components/tasks/priority-badge";
import { updateTaskStatus } from "@/app/actions/tasks";
import {
  type SampleTask, type TaskStatus, type TaskModule,
  STATUS_META, MODULE_LABELS, ROLE_LABELS,
  relativeDate, fmtTaskDate, effectiveStatus,
  SAMPLE_TASKS,
} from "@/lib/tasks-data";

const TODAY = "2026-05-21";

interface Props {
  tasks: SampleTask[];
}

export function TaskContent({ tasks: initialTasks }: Props) {
  const [tasks, setTasks]           = useState<SampleTask[]>(initialTasks);
  const [moduleFilter, setModule]   = useState<TaskModule | "All">("All");
  const [roleFilter, setRole]       = useState<string>("All");
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({ completed: true });
  const [pending, startTransition]  = useTransition();

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (moduleFilter !== "All" && t.module !== moduleFilter) return false;
      if (roleFilter !== "All" && t.assigned_to_role !== roleFilter) return false;
      return true;
    });
  }, [tasks, moduleFilter, roleFilter]);

  // ── Grouping ──────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const sevenDaysOut = new Date(new Date(TODAY).getTime() + 7 * 86_400_000)
      .toISOString().split("T")[0];

    const overdue:    SampleTask[] = [];
    const inProgress: SampleTask[] = [];
    const thisWeek:   SampleTask[] = [];
    const upcoming:   SampleTask[] = [];
    const completed:  SampleTask[] = [];

    filtered.forEach((t) => {
      const eff = effectiveStatus(t, TODAY);
      if (eff === "completed" || t.status === "cancelled") {
        completed.push(t);
      } else if (eff === "overdue") {
        overdue.push(t);
      } else if (t.status === "in_progress") {
        inProgress.push(t);
      } else if (t.due_date && t.due_date <= sevenDaysOut) {
        thisWeek.push(t);
      } else {
        upcoming.push(t);
      }
    });

    const byDue = (a: SampleTask, b: SampleTask) =>
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
    const byPri = (a: SampleTask, b: SampleTask) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    };

    return {
      overdue:    overdue.sort(byPri),
      inProgress: inProgress.sort(byDue),
      thisWeek:   thisWeek.sort(byDue),
      upcoming:   upcoming.sort(byDue),
      completed:  completed.sort((a, b) =>
        (b.completed_at ?? "").localeCompare(a.completed_at ?? "")),
    };
  }, [filtered]);

  // Counts for stats bar
  const totalOverdue    = tasks.filter((t) => effectiveStatus(t, TODAY) === "overdue").length;
  const totalInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const totalCompleted  = tasks.filter((t) => t.status === "completed").length;

  // ── Status update handler ─────────────────────────────────────────────────
  const handleStatus = (taskId: string, newStatus: TaskStatus) => {
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, newStatus);
      if (result.success) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: newStatus,
                  completed_at: newStatus === "completed" ? new Date().toISOString() : t.completed_at,
                }
              : t
          )
        );
      }
    });
  };

  const toggleSection = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="space-y-5">

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Tasks"   value={tasks.length}      className="bg-white border-border" />
        <StatCard label="Overdue"       value={totalOverdue}      className="bg-red-50 border-red-200 text-red-700" />
        <StatCard label="In Progress"   value={totalInProgress}   className="bg-purple-50 border-purple-200 text-purple-700" />
        <StatCard label="Completed"     value={totalCompleted}    className="bg-green-50 border-green-200 text-green-700" />
      </div>

      {/* ── Filter row ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-brand-gray-mid mr-1">Module:</span>
        <FilterPill label="All" active={moduleFilter === "All"} onClick={() => setModule("All")} />
        {(Object.keys(MODULE_LABELS) as TaskModule[]).map((mod) => {
          const count = tasks.filter(t => t.module === mod).length;
          return (
            <FilterPill
              key={mod}
              label={MODULE_LABELS[mod]}
              count={count}
              active={moduleFilter === mod}
              onClick={() => setModule(mod)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs font-medium text-brand-gray-mid mr-1">Assignee:</span>
        {["All", "accounts", "cfo", "ca", "ceo"].map((role) => (
          <FilterPill
            key={role}
            label={role === "All" ? "All" : ROLE_LABELS[role]?.label ?? role}
            active={roleFilter === role}
            onClick={() => setRole(role)}
          />
        ))}
      </div>

      {/* ── Task groups ──────────────────────────────────────────────── */}
      <TaskSection
        title="Overdue" count={groups.overdue.length}
        icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
        headerClass="bg-red-50 border-red-200" titleClass="text-red-800"
        tasks={groups.overdue} collapsed={collapsed["overdue"] ?? false}
        onToggle={() => toggleSection("overdue")}
        onStatusChange={handleStatus} isPending={pending}
      />
      <TaskSection
        title="In Progress" count={groups.inProgress.length}
        icon={<PlayCircle className="w-4 h-4 text-purple-600" />}
        headerClass="bg-purple-50 border-purple-200" titleClass="text-purple-800"
        tasks={groups.inProgress} collapsed={collapsed["inProgress"] ?? false}
        onToggle={() => toggleSection("inProgress")}
        onStatusChange={handleStatus} isPending={pending}
      />
      <TaskSection
        title="Due This Week" count={groups.thisWeek.length}
        icon={<Clock className="w-4 h-4 text-amber-600" />}
        headerClass="bg-amber-50 border-amber-200" titleClass="text-amber-800"
        tasks={groups.thisWeek} collapsed={collapsed["thisWeek"] ?? false}
        onToggle={() => toggleSection("thisWeek")}
        onStatusChange={handleStatus} isPending={pending}
      />
      <TaskSection
        title="Upcoming" count={groups.upcoming.length}
        icon={<Calendar className="w-4 h-4 text-blue-600" />}
        headerClass="bg-blue-50 border-blue-200" titleClass="text-blue-800"
        tasks={groups.upcoming} collapsed={collapsed["upcoming"] ?? false}
        onToggle={() => toggleSection("upcoming")}
        onStatusChange={handleStatus} isPending={pending}
      />
      <TaskSection
        title="Completed" count={groups.completed.length}
        icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
        headerClass="bg-green-50 border-green-200" titleClass="text-green-800"
        tasks={groups.completed} collapsed={collapsed["completed"] ?? true}
        onToggle={() => toggleSection("completed")}
        onStatusChange={handleStatus} isPending={pending}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="text-xs text-brand-gray-mid mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function FilterPill({ label, count, active, onClick }: {
  label: string; count?: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-brand-red text-white border-brand-red"
          : "bg-white text-brand-gray-mid border-border hover:border-brand-red/40 hover:text-brand-black"
      }`}
    >
      {label}{count !== undefined && ` (${count})`}
    </button>
  );
}

function TaskSection({
  title, count, icon, headerClass, titleClass, tasks, collapsed, onToggle, onStatusChange, isPending,
}: {
  title: string; count: number; icon: React.ReactNode;
  headerClass: string; titleClass: string;
  tasks: SampleTask[]; collapsed: boolean; onToggle: () => void;
  onStatusChange: (id: string, status: TaskStatus) => void; isPending: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 border-b border-border ${headerClass}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-semibold ${titleClass}`}>{title}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full bg-white/60 ${titleClass}`}>
            {count}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
          : <ChevronUp   className="w-4 h-4 text-brand-gray-mid" />}
      </button>
      {!collapsed && (
        <div className="divide-y divide-border bg-white">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} onStatusChange={onStatusChange} isPending={isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task, onStatusChange, isPending,
}: {
  task: SampleTask;
  onStatusChange: (id: string, status: TaskStatus) => void;
  isPending: boolean;
}) {
  const eff    = effectiveStatus(task, TODAY);
  const rel    = relativeDate(task.due_date, TODAY);
  const isDone = task.status === "completed" || task.status === "cancelled";
  const roleInfo = ROLE_LABELS[task.assigned_to_role] ?? { initials: "?", color: "bg-gray-400 text-white", label: task.assigned_to_role };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3 hover:bg-brand-gray-light/40 transition-colors">
      {/* Priority dot */}
      <span className={`w-2 h-2 rounded-full shrink-0 hidden sm:block ${
        task.priority === "urgent" ? "bg-red-500" :
        task.priority === "high"   ? "bg-orange-500" :
        task.priority === "medium" ? "bg-yellow-500" : "bg-gray-400"
      }`} />

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/dashboard/tasks/${task.id}`}
          className="text-sm font-semibold text-brand-black hover:text-brand-red transition-colors block truncate"
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <span className="text-xs text-brand-gray-mid">{task.assigned_to}</span>
          {task.module !== "general" && (
            <>
              <span className="text-brand-gray-mid/40">·</span>
              <span className="flex items-center gap-1 text-[10px] text-brand-gray-mid">
                <Tag className="w-2.5 h-2.5" />{MODULE_LABELS[task.module]}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0 flex-wrap">
        {/* Due date */}
        {task.due_date && (
          <div className="text-right hidden md:block">
            <p className="text-xs font-medium text-brand-black">{fmtTaskDate(task.due_date)}</p>
            <p className={`text-[10px] font-medium ${
              eff === "overdue" ? "text-red-600" :
              task.due_date <= new Date(new Date(TODAY).getTime() + 7 * 86_400_000).toISOString().split("T")[0]
                ? "text-amber-600" : "text-brand-gray-mid"
            }`}>
              {rel}
            </p>
          </div>
        )}

        <PriorityBadge priority={task.priority} size="sm" />

        {/* Status badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${STATUS_META[eff].className}`}>
          {STATUS_META[eff].label}
        </span>

        {/* Actions */}
        {!isDone && (
          <div className="flex gap-1">
            {task.status === "pending" && eff !== "overdue" && (
              <button
                onClick={() => onStatusChange(task.id, "in_progress")}
                disabled={isPending}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors whitespace-nowrap"
              >
                Start
              </button>
            )}
            {(task.status === "in_progress" || eff === "overdue") && (
              <button
                onClick={() => onStatusChange(task.id, "completed")}
                disabled={isPending}
                className="text-xs font-medium px-2 py-1 rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap"
              >
                Done
              </button>
            )}
            {eff === "overdue" && (
              <button
                disabled
                title="Escalate to CFO — click for full task to escalate"
                className="text-xs font-medium px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-700 opacity-80 whitespace-nowrap cursor-not-allowed"
              >
                <ArrowUpCircle className="w-3 h-3 inline mr-0.5" /> Escalate
              </button>
            )}
            <Link
              href={`/dashboard/tasks/${task.id}`}
              className="text-xs font-medium px-2 py-1 rounded-lg border border-border text-brand-gray-mid hover:text-brand-black hover:border-brand-red/30 transition-colors"
            >
              View
            </Link>
          </div>
        )}
        {isDone && (
          <Link
            href={`/dashboard/tasks/${task.id}`}
            className="text-xs text-brand-gray-mid hover:text-brand-black transition-colors"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
}
