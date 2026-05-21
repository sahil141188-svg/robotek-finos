"use client";

/**
 * New Task Page — Module 4
 *
 * Client-side form that calls the createTask server action.
 * Supports registered-user picker (dropdown from Supabase) + manual name entry.
 */

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { createTask } from "@/app/actions/tasks";
import { getTeamUsers, type TeamUser } from "@/app/actions/users";
import { ArrowLeft, Loader2, CheckCircle2, User, PenLine } from "lucide-react";
import type { TaskPriority, TaskModule } from "@/lib/tasks-data";
import { ROLE_LABELS } from "@/lib/roles";

const MODULES: { value: TaskModule; label: string }[] = [
  { value: "compliance",  label: "Compliance" },
  { value: "payables",    label: "Accounts Payable" },
  { value: "receivables", label: "Accounts Receivable" },
  { value: "import",      label: "Data Import" },
  { value: "review",      label: "Review Engine" },
  { value: "general",     label: "General" },
];

const PRIORITIES: { value: TaskPriority; label: string; className: string }[] = [
  { value: "urgent", label: "🔴 Urgent", className: "border-red-300 bg-red-50 text-red-800" },
  { value: "high",   label: "🟠 High",   className: "border-orange-300 bg-orange-50 text-orange-800" },
  { value: "medium", label: "🟡 Medium", className: "border-yellow-300 bg-yellow-50 text-yellow-800" },
  { value: "low",    label: "⚪ Low",    className: "border-gray-300 bg-gray-50 text-gray-700" },
];

type AssignMode = "team" | "manual";

export default function NewTaskPage() {
  const router  = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess]        = useState(false);

  const [title,       setTitle]       = useState("");
  const [desc,        setDesc]        = useState("");
  const [priority,    setPriority]    = useState<TaskPriority>("medium");
  const [module,      setModule]      = useState<TaskModule>("general");
  const [dueDate,     setDueDate]     = useState("");
  const [errors,      setErrors]      = useState<string[]>([]);

  // Assignment
  const [assignMode,  setAssignMode]  = useState<AssignMode>("team");
  const [teamUsers,   setTeamUsers]   = useState<TeamUser[]>([]);
  const [loadingUsers,setLoadingUsers]= useState(true);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualName,  setManualName]  = useState("");

  // Load team users on mount
  useEffect(() => {
    getTeamUsers().then((users) => {
      setTeamUsers(users);
      setLoadingUsers(false);
      // Pre-select first user if available
      if (users.length > 0) setSelectedUserId(users[0].id);
    }).catch(() => setLoadingUsers(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    if (!title.trim()) newErrors.push("Title is required");
    if (assignMode === "manual" && !manualName.trim()) newErrors.push("Assignee name is required");
    if (newErrors.length) { setErrors(newErrors); return; }
    setErrors([]);

    startTransition(async () => {
      const result = await createTask({
        title:               title.trim(),
        description:         desc.trim() || undefined,
        priority,
        module,
        due_date:            dueDate || undefined,
        assigned_to_user_id: assignMode === "team" && selectedUserId ? selectedUserId : undefined,
        assigned_to_name:    assignMode === "manual" ? manualName.trim() : undefined,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard/tasks"), 1500);
      } else {
        setErrors([result.message]);
      }
    });
  };

  return (
    <>
      <Header
        title="New Task"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks",     href: "/dashboard/tasks" },
          { label: "New Task" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-2xl">
        <Link href="/dashboard/tasks" className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black mb-5 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>

        {success ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="font-semibold text-green-800">Task created successfully!</p>
            <p className="text-sm text-green-700">Redirecting to task list…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-5 sm:p-6 space-y-5">
            <h2 className="text-base font-bold text-brand-black">Create a New Task</h2>

            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {errors.map((e) => <p key={e} className="text-sm text-red-700">{e}</p>)}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-brand-black mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. File TDS Return Q1 FY26-27"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-brand-black mb-1">
                Description <span className="text-brand-gray-mid font-normal">(optional)</span>
              </label>
              <textarea
                placeholder="Additional context, steps, links..."
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
              />
            </div>

            {/* ── Assign to ─────────────────────────────────────── */}
            <div>
              <label className="block text-xs font-medium text-brand-black mb-2">Assign To</label>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setAssignMode("team")}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    assignMode === "team"
                      ? "bg-brand-red text-white border-brand-red"
                      : "border-border text-brand-gray-mid hover:text-brand-black"
                  }`}
                >
                  <User className="w-3.5 h-3.5" /> Team Member
                </button>
                <button
                  type="button"
                  onClick={() => setAssignMode("manual")}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    assignMode === "manual"
                      ? "bg-brand-red text-white border-brand-red"
                      : "border-border text-brand-gray-mid hover:text-brand-black"
                  }`}
                >
                  <PenLine className="w-3.5 h-3.5" /> Enter Manually
                </button>
              </div>

              {assignMode === "team" ? (
                loadingUsers ? (
                  <div className="flex items-center gap-2 text-sm text-brand-gray-mid py-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading team…
                  </div>
                ) : teamUsers.length === 0 ? (
                  <div className="text-xs text-brand-gray-mid py-2 bg-brand-gray-light rounded-lg px-3">
                    No team members found in the system.{" "}
                    <button type="button" onClick={() => setAssignMode("manual")} className="text-brand-red underline">
                      Enter manually instead
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {teamUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className={`text-left px-3 py-2.5 rounded-lg border text-xs transition-all ${
                          selectedUserId === u.id
                            ? "border-brand-red bg-brand-red/5 ring-1 ring-brand-red/30"
                            : "border-border hover:border-brand-red/30"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand-red flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-bold uppercase">
                              {u.full_name.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-brand-black truncate">{u.full_name}</p>
                            <p className="text-brand-gray-mid">{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</p>
                          </div>
                          {selectedUserId === u.id && (
                            <CheckCircle2 className="w-4 h-4 text-brand-red ml-auto shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma (CA)"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-medium text-brand-black mb-2">Priority</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITIES.map(({ value, label, className }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    className={`text-xs font-medium px-3 py-2 rounded-lg border-2 transition-all ${
                      priority === value ? `${className} ring-2 ring-offset-1 ring-current` : "border-border bg-white text-brand-gray-mid hover:border-brand-red/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Module + Due date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-brand-black mb-1">Module</label>
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value as TaskModule)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 bg-white"
                >
                  {MODULES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-black mb-1">
                  Due Date <span className="text-brand-gray-mid font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                type="submit"
                className="bg-brand-red hover:bg-brand-maroon text-white"
                disabled={isPending}
              >
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating…</>
                  : "Create Task"
                }
              </Button>
              <Link href="/dashboard/tasks">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
            </div>
          </form>
        )}
      </main>
    </>
  );
}
