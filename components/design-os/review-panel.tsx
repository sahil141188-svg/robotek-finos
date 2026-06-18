"use client";

import { useState, useTransition } from "react";
import { reviewSubmission, finalApproval } from "@/app/actions/design-os";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";

interface ReviewPanelProps {
  submissionId: string;
  mode: "sarthak" | "management";
  taskId: string;
}

export function ReviewPanel({ submissionId, mode, taskId }: ReviewPanelProps) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState("");

  const act = (decision: "approved" | "needs_correction" | "final_approved" | "rejected") => {
    startTransition(async () => {
      try {
        if (mode === "sarthak") {
          await reviewSubmission(submissionId, decision as "approved" | "needs_correction", note);
        } else {
          await finalApproval(submissionId, decision as "final_approved" | "rejected", note);
        }
        setDone(decision);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  if (done) {
    const msgs: Record<string, string> = {
      approved:         "✓ Design approved — sent for final management approval",
      needs_correction: "↩ Correction requested — designer notified",
      final_approved:   "✓ Final approval granted!",
      rejected:         "✗ Design rejected",
    };
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm font-medium">
        {msgs[done]}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-600" />
        {mode === "sarthak" ? "Review Design (Sarthak)" : "Final Approval (Management)"}
      </h3>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={mode === "sarthak" ? "Add feedback or correction notes…" : "Add approval or rejection notes…"}
        rows={3}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        {mode === "sarthak" ? (
          <>
            <button
              onClick={() => act("approved")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Approve
            </button>
            <button
              onClick={() => act("needs_correction")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-red-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Needs Correction
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => act("final_approved")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Final Approve
            </button>
            <button
              onClick={() => act("rejected")}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <XCircle className="w-4 h-4" /> Reject
            </button>
          </>
        )}
      </div>
    </div>
  );
}
