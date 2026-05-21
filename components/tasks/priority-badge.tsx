import { PRIORITY_META, type TaskPriority } from "@/lib/tasks-data";

interface PriorityBadgeProps {
  priority: TaskPriority;
  size?: "sm" | "md";
  showDot?: boolean;
}

export function PriorityBadge({ priority, size = "md", showDot = false }: PriorityBadgeProps) {
  const { label, className, dot } = PRIORITY_META[priority];
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-medium ${sizeClass} ${className}`}>
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
      {label}
    </span>
  );
}
