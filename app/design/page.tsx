/**
 * Designer Portal Home — shows tasks assigned to this designer,
 * or all tasks for Sarthak (reviewer).
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Palette, Clock, CheckCircle2, RefreshCw, Hourglass, AlertCircle, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:   { label: "Under Review",      color: "bg-amber-100 text-amber-700",  icon: <Hourglass className="w-4 h-4" /> },
  approved:         { label: "Approved",           color: "bg-blue-100 text-blue-700",    icon: <CheckCircle2 className="w-4 h-4" /> },
  needs_correction: { label: "Needs Correction",   color: "bg-red-100 text-red-700",      icon: <RefreshCw className="w-4 h-4" /> },
  final_approved:   { label: "Final Approved ✓",   color: "bg-green-100 text-green-700",  icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected:         { label: "Rejected",           color: "bg-gray-100 text-gray-600",    icon: <AlertCircle className="w-4 h-4" /> },
  no_submission:    { label: "Upload Required",    color: "bg-purple-100 text-purple-700",icon: <Upload className="w-4 h-4" /> },
};

export default async function DesignPortalHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/design/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db.from("users").select("full_name, role").eq("id", user.id).single();
  const role: string = profile?.role ?? "";
  const name: string = profile?.full_name ?? "";

  // Determine designer name from full_name
  const firstName = name.split(" ")[0].toLowerCase();
  const isReviewer = role === "reviewer" || role === "ceo" || role === "coo";
  const isDesigner = role === "designer" || firstName === "vishal" || firstName === "nitin";

  // Fetch tasks
  const { data: tasks } = await db
    .from("design_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  const allTasks = (tasks ?? []) as Array<{
    id: string; title: string; task_type: string; platform: string | null;
    assigned_to: string; deadline: string | null; priority: string;
  }>;

  // Filter by role
  const myTasks = isReviewer
    ? allTasks
    : allTasks.filter((t) =>
        t.assigned_to === firstName || t.assigned_to === "both"
      );

  // Fetch latest submission for each task
  const tasksWithStatus = await Promise.all(
    myTasks.map(async (task) => {
      const { data: subs } = await db
        .from("design_submissions")
        .select("id, status, round, reviewer_note")
        .eq("task_id", task.id)
        .order("round", { ascending: false })
        .limit(1);
      return { ...task, sub: subs?.[0] ?? null };
    })
  );

  // For reviewer: filter to only pending_review
  const displayTasks = isReviewer
    ? tasksWithStatus.filter((t) => t.sub?.status === "pending_review" || !t.sub)
    : tasksWithStatus;

  const pendingCount  = tasksWithStatus.filter((t) => !t.sub || t.sub.status === "needs_correction").length;
  const reviewCount   = tasksWithStatus.filter((t) => t.sub?.status === "pending_review").length;
  const doneCount     = tasksWithStatus.filter((t) => t.sub?.status === "final_approved").length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {isReviewer ? "Review Queue" : `My Tasks`}
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isReviewer
            ? `${reviewCount} submission${reviewCount !== 1 ? "s" : ""} waiting for your review (target: within 4 hours)`
            : `Hi ${name.split(" ")[0]} — ${pendingCount} task${pendingCount !== 1 ? "s" : ""} need your attention`}
        </p>
      </div>

      {/* KPI pills */}
      <div className="flex gap-2 flex-wrap">
        <Pill label="Total" value={myTasks.length} color="bg-gray-100 text-gray-700" />
        {isReviewer ? (
          <Pill label="Pending Review" value={reviewCount} color="bg-amber-100 text-amber-700" />
        ) : (
          <Pill label="Need Upload" value={pendingCount} color="bg-purple-100 text-purple-700" />
        )}
        <Pill label="Final Approved" value={doneCount} color="bg-green-100 text-green-700" />
      </div>

      {/* Task list */}
      {displayTasks.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <p className="font-medium text-gray-700">
            {isReviewer ? "No submissions pending review — all clear!" : "No tasks assigned to you yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayTasks.map((task) => {
            const status = task.sub?.status ?? "no_submission";
            const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.no_submission;
            const isOverdue = task.deadline && new Date(task.deadline) < new Date();

            return (
              <Link key={task.id} href={`/design/tasks/${task.id}`}>
                <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{task.title}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task.task_type}</span>
                        {task.platform && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task.platform}</span>}
                        {task.sub?.round && task.sub.round > 1 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Round {task.sub.round}</span>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {task.sub?.reviewer_note && status === "needs_correction" && (
                    <div className="mt-3 bg-red-50 rounded-lg px-3 py-2 text-xs text-red-700">
                      <span className="font-semibold">Correction needed: </span>{task.sub.reviewer_note}
                    </div>
                  )}

                  {task.deadline && (
                    <div className={`mt-2 flex items-center gap-1 text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {isOverdue ? "Overdue: " : "Due: "}
                      {new Date(task.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Pill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${color}`}>
      <span className="font-bold">{value}</span> {label}
    </div>
  );
}
