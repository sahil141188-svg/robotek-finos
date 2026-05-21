"use client";

/**
 * TaskDetailActions — status update buttons for the task detail page.
 * Shows escalate button for overdue tasks.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle, ArrowUpCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/app/actions/tasks";
import { type SampleTask, effectiveStatus } from "@/lib/tasks-data";

const TODAY = "2026-05-21";

export function TaskDetailActions({ task }: { task: SampleTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone]              = useState(false);
  const [note, setNote]              = useState("");

  const eff = effectiveStatus(task, TODAY);

  const handle = (status: "in_progress" | "completed" | "cancelled") => {
    startTransition(async () => {
      // For demo: updateTaskStatus writes to Supabase if available, otherwise is a no-op
      await updateTaskStatus(task.id, status, note || undefined);
      setDone(true);
      setTimeout(() => router.push("/dashboard/tasks"), 1200);
    });
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4" /> Updated — redirecting…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Note */}
      <div>
        <label className="block text-xs font-medium text-brand-black mb-1">
          Note <span className="text-brand-gray-mid font-normal">(optional)</span>
        </label>
        <textarea
          placeholder="Add a note about this status change..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {task.status === "pending" && (
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={() => handle("in_progress")}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <PlayCircle className="w-4 h-4 mr-1" />}
            Mark In Progress
          </Button>
        )}
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={() => handle("completed")}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
          Mark Complete
        </Button>
        {eff === "overdue" && (
          <Button
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={() => {
              // In real app: escalateTask(task.id, cfoUserId)
              handle("in_progress");
            }}
            disabled={isPending}
          >
            <ArrowUpCircle className="w-4 h-4 mr-1" /> Escalate to CFO
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => handle("cancelled")}
          disabled={isPending}
          className="text-brand-gray-mid"
        >
          <XCircle className="w-4 h-4 mr-1" /> Cancel Task
        </Button>
      </div>
    </div>
  );
}
