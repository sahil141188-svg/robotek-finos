"use client";

import Link from "next/link";
import { Clock, User, ChevronRight, AlertCircle, CheckCircle2, XCircle, RefreshCw, Hourglass } from "lucide-react";

type Status = "pending_review" | "approved" | "needs_correction" | "final_approved" | "rejected" | null;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending_review:  { label: "Under Review",     color: "bg-amber-100 text-amber-700",  icon: <Hourglass className="w-3.5 h-3.5" /> },
  approved:        { label: "Approved",          color: "bg-blue-100 text-blue-700",    icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  needs_correction:{ label: "Needs Correction",  color: "bg-red-100 text-red-700",      icon: <RefreshCw className="w-3.5 h-3.5" /> },
  final_approved:  { label: "Final Approved",    color: "bg-green-100 text-green-700",  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected:        { label: "Rejected",          color: "bg-gray-100 text-gray-600",    icon: <XCircle className="w-3.5 h-3.5" /> },
  no_submission:   { label: "Awaiting Upload",   color: "bg-purple-100 text-purple-700",icon: <AlertCircle className="w-3.5 h-3.5" /> },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "border-l-gray-300",
  medium: "border-l-blue-400",
  high:   "border-l-orange-400",
  urgent: "border-l-red-500",
};

interface TaskCardProps {
  id: string;
  title: string;
  task_type: string;
  platform: string | null;
  assigned_to: string;
  deadline: string | null;
  priority: string;
  status: Status;
  round?: number;
}

export function TaskCard({ id, title, task_type, platform, assigned_to, deadline, priority, status, round }: TaskCardProps) {
  const cfg = STATUS_CONFIG[status ?? "no_submission"] ?? STATUS_CONFIG.no_submission;
  const borderColor = PRIORITY_COLOR[priority] ?? PRIORITY_COLOR.medium;
  const isOverdue = deadline && new Date(deadline) < new Date() && status !== "final_approved";

  return (
    <Link href={`/dashboard/design-os/tasks/${id}`}>
      <div className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} p-4 hover:shadow-md transition-shadow cursor-pointer`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{title}</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{task_type}</span>
              {platform && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{platform}</span>}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          {round && round > 1 && (
            <span className="text-xs text-gray-500">Round {round}</span>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            {assigned_to === "both" ? "Vishal & Nitin" : assigned_to.charAt(0).toUpperCase() + assigned_to.slice(1)}
          </span>
          {deadline && (
            <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : ""}`}>
              <Clock className="w-3.5 h-3.5" />
              {isOverdue ? "Overdue: " : ""}{new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
