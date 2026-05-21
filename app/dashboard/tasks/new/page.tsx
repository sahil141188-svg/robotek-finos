"use client";

/**
 * New Task Page — Module 4
 *
 * Client-side form that calls the createTask server action.
 * Supports title, description, priority, assignee, due date, module.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { createTask } from "@/app/actions/tasks";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import type { TaskPriority, TaskModule } from "@/lib/tasks-data";

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

export default function NewTaskPage() {
  const router  = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess]        = useState(false);

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [module,   setModule]   = useState<TaskModule>("general");
  const [dueDate,  setDueDate]  = useState("");
  const [errors,   setErrors]   = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    if (!title.trim()) newErrors.push("Title is required");
    if (newErrors.length) { setErrors(newErrors); return; }
    setErrors([]);

    startTransition(async () => {
      const result = await createTask({
        title:    title.trim(),
        description: desc.trim() || undefined,
        priority,
        module,
        due_date: dueDate || undefined,
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

      <main className="flex-1 p-6 max-w-2xl">
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
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-6 space-y-5">
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
            <div className="flex gap-3 pt-2">
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
