/**
 * Design Task Detail — shows the full submission history and action panels
 * based on the current step in the flow.
 */

import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { getDesignTask } from "@/app/actions/design-os";
import { requireAuth } from "@/lib/auth";
import { SubmitDesignForm } from "@/components/design-os/submit-design-form";
import { ReviewPanel } from "@/components/design-os/review-panel";
import {
  ArrowLeft, Clock, User, Tag, Calendar, FileText,
  Image, Video, File, CheckCircle2, XCircle, RefreshCw,
  Hourglass, ExternalLink, AlertCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

type Status = "pending_review" | "approved" | "needs_correction" | "final_approved" | "rejected";

const STATUS_CONFIG: Record<Status | "no_submission", { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:   { label: "Under Review by Sarthak",  color: "bg-amber-100 text-amber-700",  icon: <Hourglass className="w-4 h-4" /> },
  approved:         { label: "Approved — Awaiting Final", color: "bg-blue-100 text-blue-700",    icon: <CheckCircle2 className="w-4 h-4" /> },
  needs_correction: { label: "Needs Correction",         color: "bg-red-100 text-red-700",      icon: <RefreshCw className="w-4 h-4" /> },
  final_approved:   { label: "Final Approved ✓",         color: "bg-green-100 text-green-700",  icon: <CheckCircle2 className="w-4 h-4" /> },
  rejected:         { label: "Rejected",                 color: "bg-gray-100 text-gray-600",    icon: <XCircle className="w-4 h-4" /> },
  no_submission:    { label: "Awaiting Designer Upload", color: "bg-purple-100 text-purple-700",icon: <AlertCircle className="w-4 h-4" /> },
};

function fileIcon(type: string | null) {
  if (type === "image") return <Image className="w-4 h-4 text-blue-500" />;
  if (type === "pdf")   return <FileText className="w-4 h-4 text-red-500" />;
  if (type === "video") return <Video className="w-4 h-4 text-purple-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

function formatSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuth();
  const task = await getDesignTask(id);
  if (!task) notFound();

  const submissions = (task as { submissions: unknown[] }).submissions as Array<{
    id: string;
    round: number;
    submitted_by: string;
    submitted_at: string;
    status: Status;
    reviewer_note: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    final_note: string | null;
    final_at: string | null;
    files: Array<{ id: string; file_name: string; file_url: string; file_type: string | null; file_size: number | null }>;
  }>;

  const latest = submissions[0] ?? null;
  const latestStatus: Status | "no_submission" = latest?.status ?? "no_submission";
  const statusCfg = STATUS_CONFIG[latestStatus];
  const nextRound = (latest?.round ?? 0) + 1;

  // Determine what action panels to show
  const showDesignerUpload = !latest || latest.status === "needs_correction";
  const showSarthakReview  = latest?.status === "pending_review";
  const showFinalApproval  = latest?.status === "approved";

  const priorityColor: Record<string, string> = {
    low: "text-gray-500", medium: "text-blue-600", high: "text-orange-600", urgent: "text-red-600",
  };

  return (
    <>
      <Header
        title={task.title as string}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Design OS", href: "/dashboard/design-os" },
          { label: task.title as string },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 max-w-4xl space-y-5">
        <Link href="/dashboard/design-os" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="w-4 h-4" /> All Tasks
        </Link>

        {/* Task header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{task.title as string}</h1>
              {task.description && <p className="text-sm text-gray-600 mt-1">{task.description as string}</p>}
            </div>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${statusCfg.color}`}>
              {statusCfg.icon} {statusCfg.label}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <InfoItem icon={<Tag className="w-3.5 h-3.5" />}      label="Type"     value={task.task_type as string} />
            <InfoItem icon={<User className="w-3.5 h-3.5" />}     label="Assigned" value={
              (task.assigned_to as string) === "both" ? "Vishal & Nitin"
              : ((task.assigned_to as string).charAt(0).toUpperCase() + (task.assigned_to as string).slice(1))
            } />
            <InfoItem icon={<Clock className="w-3.5 h-3.5" />}    label="Priority" value={(task.priority as string).toUpperCase()}
              valueClass={priorityColor[task.priority as string]} />
            {task.deadline && (
              <InfoItem icon={<Calendar className="w-3.5 h-3.5" />} label="Deadline"
                value={new Date(task.deadline as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
            )}
          </div>

          {task.notes && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
              <span className="font-medium">Notes: </span>{task.notes as string}
            </div>
          )}

          {task.reference_url && (
            <a href={task.reference_url as string} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> View Reference
            </a>
          )}
        </div>

        {/* Flow steps indicator */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Current Step</p>
          <div className="flex gap-1 items-center flex-wrap text-xs">
            {[
              { step: "Task Assigned", done: true },
              { step: "Design Made", done: !!latest },
              { step: "Sarthak Review", done: latest && latest.status !== "pending_review" },
              { step: "Share for Final", done: latest?.status === "approved" || latest?.status === "final_approved" },
              { step: "Final Approval", done: latest?.status === "final_approved" },
            ].map((s, i, arr) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`px-2.5 py-1 rounded-lg font-medium ${
                  s.done ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {s.done ? "✓ " : ""}{s.step}
                </div>
                {i < arr.length - 1 && <span className="text-gray-300">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Action panels */}
        {showDesignerUpload && (
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {latest?.status === "needs_correction" ? "↩ Correction Required — Resubmit" : "Step 2: Upload Your Design"}
            </p>
            {latest?.reviewer_note && (
              <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                <span className="font-semibold">Sarthak's feedback: </span>{latest.reviewer_note}
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              {((task.assigned_to as string) === "vishal" || (task.assigned_to as string) === "both") && (
                <DesignerBlock name="Vishal" taskId={id} round={nextRound} />
              )}
              {((task.assigned_to as string) === "nitin" || (task.assigned_to as string) === "both") && (
                <DesignerBlock name="Nitin" taskId={id} round={nextRound} />
              )}
            </div>
          </div>
        )}

        {showSarthakReview && (
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Step 3: Sarthak Review</p>
            <ReviewPanel submissionId={latest!.id} mode="sarthak" taskId={id} />
          </div>
        )}

        {showFinalApproval && (
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Step 5: Final Management Approval</p>
            <ReviewPanel submissionId={latest!.id} mode="management" taskId={id} />
          </div>
        )}

        {/* Submission history */}
        {submissions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-gray-900">Submission History</h2>
            {submissions.map((sub) => {
              const cfg = STATUS_CONFIG[sub.status] ?? STATUS_CONFIG.no_submission;
              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">Round {sub.round}</span>
                      <span className="text-sm text-gray-500">by {sub.submitted_by.charAt(0).toUpperCase() + sub.submitted_by.slice(1)}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(sub.submitted_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>

                  {/* Files */}
                  {sub.files?.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {sub.files.map((f) => (
                        <a
                          key={f.id}
                          href={f.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors"
                        >
                          {fileIcon(f.file_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">{f.file_name}</p>
                            {f.file_size && <p className="text-xs text-gray-500">{formatSize(f.file_size)}</p>}
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Review notes */}
                  {sub.reviewer_note && (
                    <div className="bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
                      <span className="font-semibold">Sarthak: </span>{sub.reviewer_note}
                      {sub.reviewed_at && (
                        <span className="text-xs text-amber-600 ml-2">
                          {new Date(sub.reviewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </div>
                  )}
                  {sub.final_note && (
                    <div className="bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800">
                      <span className="font-semibold">Management: </span>{sub.final_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function DesignerBlock({ name, taskId, round }: { name: string; taskId: string; round: number }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-2">{name}'s Upload</p>
      <SubmitDesignForm taskId={taskId} designerName={name.toLowerCase()} round={round} />
    </div>
  );
}

function InfoItem({ icon, label, value, valueClass = "text-gray-900" }: {
  icon: React.ReactNode; label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-gray-400 mt-0.5">{icon}</span>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`font-medium ${valueClass}`}>{value}</p>
      </div>
    </div>
  );
}
