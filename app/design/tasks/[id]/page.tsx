/**
 * Designer Portal — Task Detail
 * Reuses the same server actions as the main FinOS Design OS.
 * Shows upload form for designers, review panel for Sarthak.
 */
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDesignTask } from "@/app/actions/design-os";
import { SubmitDesignForm } from "@/components/design-os/submit-design-form";
import { ReviewPanel } from "@/components/design-os/review-panel";
import Link from "next/link";
import { ArrowLeft, FileText, Image, Video, File, ExternalLink, Clock, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

function fileIcon(type: string | null) {
  if (type === "image") return <Image className="w-4 h-4 text-blue-500" />;
  if (type === "pdf")   return <FileText className="w-4 h-4 text-red-500" />;
  if (type === "video") return <Video className="w-4 h-4 text-purple-500" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

export default async function DesignTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/design/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db.from("users").select("full_name, role").eq("id", user.id).single();
  const role: string = profile?.role ?? "";
  const name: string = profile?.full_name ?? "";
  const firstName = name.split(" ")[0].toLowerCase();

  const isReviewer = role === "reviewer" || role === "ceo" || role === "coo";
  const isDesigner = role === "designer" || firstName === "vishal" || firstName === "nitin";

  const task = await getDesignTask(id);
  if (!task) notFound();

  const submissions = (task as { submissions: unknown[] }).submissions as Array<{
    id: string; round: number; submitted_by: string; submitted_at: string;
    status: string; reviewer_note: string | null; reviewed_by: string | null;
    final_note: string | null; files: Array<{ id: string; file_name: string; file_url: string; file_type: string | null; file_size: number | null }>;
  }>;

  const latest = submissions[0] ?? null;
  const nextRound = (latest?.round ?? 0) + 1;
  const showDesignerUpload = isDesigner && (!latest || latest.status === "needs_correction");
  const showReview = isReviewer && latest?.status === "pending_review";

  return (
    <div className="space-y-5">
      <Link href="/design" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Back to tasks
      </Link>

      {/* Task info */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
        <h1 className="text-xl font-bold text-gray-900">{task.title as string}</h1>
        {task.description && <p className="text-sm text-gray-600">{task.description as string}</p>}
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1 text-gray-500"><Tag className="w-3.5 h-3.5" />{task.task_type as string}</span>
          {task.deadline && (
            <span className="flex items-center gap-1 text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Due: {new Date(task.deadline as string).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
        </div>
        {task.notes && (
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700">
            <span className="font-medium">Notes: </span>{task.notes as string}
          </div>
        )}
      </div>

      {/* Action panels */}
      {showDesignerUpload && (
        <div>
          {latest?.status === "needs_correction" && (
            <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <span className="font-semibold">Sarthak&apos;s feedback: </span>{latest.reviewer_note}
            </div>
          )}
          <SubmitDesignForm taskId={id} designerName={firstName} round={nextRound} />
        </div>
      )}

      {showReview && (
        <ReviewPanel submissionId={latest!.id} mode="sarthak" taskId={id} />
      )}

      {/* Submission history */}
      {submissions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Submission History</h2>
          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">Round {sub.round}</span>
                  <span className="text-sm text-gray-500">by {sub.submitted_by}</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{sub.status.replace(/_/g, " ")}</span>
              </div>
              {sub.files?.length > 0 && (
                <div className="grid gap-2">
                  {sub.files.map((f) => (
                    <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 hover:bg-gray-100 transition-colors">
                      {fileIcon(f.file_type)}
                      <span className="text-sm text-gray-800 truncate flex-1">{f.file_name}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
              {sub.reviewer_note && (
                <div className="bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
                  <span className="font-semibold">Sarthak: </span>{sub.reviewer_note}
                </div>
              )}
              {sub.final_note && (
                <div className="bg-green-50 rounded-lg px-3 py-2 text-sm text-green-800">
                  <span className="font-semibold">Management: </span>{sub.final_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
