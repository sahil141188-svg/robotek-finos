/**
 * Task Management Page — Module 4
 *
 * Server component: loads sample tasks and renders TaskContent client component.
 * "New Task" button → /dashboard/tasks/new
 */

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { TaskContent } from "@/components/tasks/task-content";
import { SAMPLE_TASKS, effectiveStatus } from "@/lib/tasks-data";
import { createClient } from "@/lib/supabase/server";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { Plus, ListChecks } from "lucide-react";
import type { SampleTask } from "@/lib/tasks-data";

// Dynamic today — never hardcode a date string or overdue detection breaks
const TODAY = new Date().toISOString().slice(0, 10);

export default async function TasksPage() {
  // Fetch real tasks from DB filtered by selected company, fall back to empty array
  let tasks: SampleTask[] = SAMPLE_TASKS;
  try {
    const supabase = await createClient();
    const db = supabase as any;
    const companyId = await getSelectedCompanyId();
    let query = db.from("tasks").select("*").order("due_date", { ascending: true });
    if (companyId) query = query.eq("company_id", companyId);
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      tasks = data as SampleTask[];
    }
  } catch (err) {
    console.error("[tasks/page] Failed to fetch tasks from DB:", err);
  }

  const overdue = tasks.filter((t) => effectiveStatus(t, TODAY) === "overdue").length;

  return (
    <>
      <Header
        title="Task Management"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-6 space-y-6 max-w-5xl">

        {/* Top action bar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-red/10 flex items-center justify-center">
              <ListChecks className="w-5 h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-sm font-bold text-brand-black">
                {tasks.length} tasks this sprint
                {overdue > 0 && (
                  <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    {overdue} overdue
                  </span>
                )}
              </p>
              <p className="text-xs text-brand-gray-mid mt-0.5">
                FY 2026-27 · Assign, track, escalate · Full audit trail
              </p>
            </div>
          </div>
          <Link href="/dashboard/tasks/new">
            <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-maroon text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> New Task
            </button>
          </Link>
        </div>

        <TaskContent tasks={tasks} />
      </main>
    </>
  );
}
