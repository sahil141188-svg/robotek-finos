/**
 * Design OS — Sarthak's Review Dashboard
 * Shows all pending_review submissions across all tasks.
 */

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClipboardList, Clock, FileStack } from "lucide-react";

export const dynamic = "force-dynamic";

interface PendingItem {
  task_id: string;
  task_title: string;
  assigned_to: string;
  round: number;
  submitted_at: string;
  file_count: number;
}

async function getPendingReviews(): Promise<PendingItem[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createClient()) as any;

  const { data: subs } = await db
    .from("design_submissions")
    .select("id, task_id, round, submitted_by, submitted_at, files:design_files(id)")
    .eq("status", "pending_review")
    .order("submitted_at", { ascending: true });

  if (!subs || subs.length === 0) return [];

  // Fetch task titles in one query
  const taskIds: string[] = [...new Set((subs as { task_id: string }[]).map((s) => s.task_id))];
  const { data: tasks } = await db
    .from("design_tasks")
    .select("id, title, assigned_to")
    .in("id", taskIds);

  const taskMap: Record<string, { title: string; assigned_to: string }> = {};
  for (const t of tasks ?? []) {
    taskMap[t.id] = { title: t.title, assigned_to: t.assigned_to };
  }

  return (subs as {
    task_id: string; round: number; submitted_by: string;
    submitted_at: string; files: { id: string }[];
  }[]).map((s) => ({
    task_id:      s.task_id,
    task_title:   taskMap[s.task_id]?.title ?? "Unknown Task",
    assigned_to:  taskMap[s.task_id]?.assigned_to ?? s.submitted_by,
    round:        s.round,
    submitted_at: s.submitted_at,
    file_count:   s.files?.length ?? 0,
  }));
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ReviewDashboardPage() {
  await requireAuth();
  const items = await getPendingReviews();

  return (
    <>
      <Header
        title="Sarthak's Review Queue"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Design OS", href: "/dashboard/design-os" },
          { label: "Review Queue" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 space-y-6 max-w-4xl">
        {/* Count banner */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
          <ClipboardList className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {items.length === 0
                ? "No pending reviews — queue is clear!"
                : `${items.length} submission${items.length > 1 ? "s" : ""} waiting for review`}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Oldest submission shown first. Target: review within 4 hours.
            </p>
          </div>
        </div>

        {/* Table */}
        {items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-700">Queue is empty</p>
            <p className="text-sm text-gray-500 mt-1">All submissions have been reviewed.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Task</th>
                  <th className="text-left px-4 py-3">Designer</th>
                  <th className="text-left px-4 py-3">Round</th>
                  <th className="text-left px-4 py-3">Submitted</th>
                  <th className="text-left px-4 py-3">Files</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={`${item.task_id}-${item.round}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{item.task_title}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{item.assigned_to}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Round {item.round}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatTime(item.submitted_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileStack className="w-3.5 h-3.5" />
                        {item.file_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/design-os/tasks/${item.task_id}`}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
