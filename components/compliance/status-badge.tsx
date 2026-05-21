import { getStatusMeta, type ComplianceStatus } from "@/lib/compliance-data";

interface StatusBadgeProps {
  status: ComplianceStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const { label, className } = getStatusMeta(status);
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClass} ${className}`}>
      {label}
    </span>
  );
}
