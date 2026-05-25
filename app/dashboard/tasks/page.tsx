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

/** Bug #29 fix: compute FY label dynamically so it doesn't become stale */
function getCurrentFYLabel(): string {
  const m = new Date().getMonth() + 1; // 1-indexed
  const y = new Date().getFullYear();
  const start = m >= 4 ? y : y - 1;
  return `FY ${start}-${String(start + 1).slice(2)}`;
}


export const dynamic = "force-dynamic";

export default async function TasksPage() {
  // Bug #9 fix: initialise to [] — not SAMPLE_TASKS — so DB errors don't
  // surface stale sample data and are surfaced as an empty state instead.
  let tasks: SampleTask[] = [];
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

      <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6 space-y-4 sm:space-y-6 max-w-5xl">

        {/* Top action bar */}
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-brand-red/10 flex items-center justify-center shrink-0">
              <ListChecks className="w-4 h-4 sm:w-5 sm:h-5 text-brand-red" />
            </div>
            <div>
              <p className="text-sm font-bold text-brand-black">
                {tasks.length} tasks
                {overdue > 0 && (
                  <span className="ml-2 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    {overdue} overdue
                  </span>
                )}
              </p>
              <p className="text-xs text-brand-gray-mid mt-0.5 hidden sm:block">
                {getCurrentFYLabel()} · Assign, track, escalate
              </p>
            </div>
          </div>
          {/* Desktop: inline button */}
          <Link href="/dashboard/tasks/new" className="hidden sm:block">
            <button className="flex items-center gap-2 bg-brand-red hover:bg-brand-maroon text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> New Task
            </button>
          </Link>
        </div>

        <TaskContent tasks={tasks} />
      </main>

      {/* Mobile: sticky "New Task" button pinned to bottom */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-border z-20">
        <Link href="/dashboard/tasks/new" className="block">
          <button className="w-full flex items-center justify-center gap-2 bg-brand-red hover:bg-brand-maroon text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors shadow-md">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </Link>
      </div>
    </>
  );
}
