"use client";

/**
 * TaskDetailActions — status update + escalation buttons for the task detail page.
 *
 * Bug #19 fix: Escalate button now calls escalateTask() (assigns to CFO, sets
 *   priority:urgent, writes audit log) instead of incorrectly calling
 *   handle("in_progress") which just changed status locally.
 *
 * Bug #20 fix: router.refresh() immediately after a status update so the
 *   server component re-fetches the fresh task before the redirect fires.
 */

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PlayCircle, ArrowUpCircle, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateTaskStatus, escalateTask } from "@/app/actions/tasks";
import { getTeamUsers, type TeamUser } from "@/app/actions/users";
import { type SampleTask, effectiveStatus } from "@/lib/tasks-data";

const TODAY = new Date().toISOString().slice(0, 10);

export function TaskDetailActions({ task }: { task: SampleTask }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone]             = useState(false);
  const [note, setNote]             = useState("");
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Bug #19 fix: load team members so we can resolve the CFO's UUID for escalation
  const [cfoUser, setCfoUser] = useState<TeamUser | null>(null);
  useEffect(() => {
    getTeamUsers().then((users) => {
      const cfo = users.find((u) => u.role === "cfo" || u.role === "ceo");
      setCfoUser(cfo ?? null);
    }).catch(() => {});
  }, []);

  const eff = effectiveStatus(task, TODAY);

  const handle = (status: "in_progress" | "completed" | "cancelled") => {
    setUpdateError(null);
    startTransition(async () => {
      try {
        await updateTaskStatus(task.id, status, note || undefined);
        setDone(true);
        // Bug #20 fix: refresh server data before redirect so stale status is not shown
        router.refresh();
        setTimeout(() => router.push("/dashboard/tasks"), 1200);
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : "Failed to update task. Please try again.");
      }
    });
  };

  // Bug #19 fix: real escalation — reassigns task to CFO, sets priority urgent
  const handleEscalate = () => {
    if (!cfoUser) {
      setUpdateError("No CFO/CEO found in the system to escalate to.");
      return;
    }
    setUpdateError(null);
    startTransition(async () => {
      try {
        const result = await escalateTask(task.id, cfoUser.id);
        if (!result.success) throw new Error(result.message);
        setDone(true);
        router.refresh();
        setTimeout(() => router.push("/dashboard/tasks"), 1200);
      } catch (err) {
        setUpdateError(err instanceof Error ? err.message : "Escalation failed. Please try again.");
      }
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
      {updateError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{updateError}</p>
        </div>
      )}

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
            onClick={handleEscalate}
            disabled={isPending || !cfoUser}
            title={cfoUser ? `Escalate to ${cfoUser.full_name}` : "Loading CFO…"}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <ArrowUpCircle className="w-4 h-4 mr-1" />}
            Escalate to {cfoUser ? cfoUser.full_name.split(" ")[0] : "CFO"}
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
