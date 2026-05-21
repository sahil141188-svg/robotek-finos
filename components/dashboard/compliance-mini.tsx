/**
 * ComplianceMini — Compact upcoming compliance widget for the dashboard bottom row.
 * Shows the next 5 compliance deadlines with colour-coded urgency:
 *   Red    → Overdue
 *   Amber  → Due within 7 days (critical)
 *   Blue   → Upcoming (> 7 days)
 */

import Link from "next/link";
import { AlertTriangle, Clock, CheckCircle } from "lucide-react";
import type { ComplianceItem } from "@/lib/dashboard-data";

interface ComplianceMiniProps {
  items: ComplianceItem[];
}

export function ComplianceMini({ items }: ComplianceMiniProps) {
  return (
    <div className="rounded-xl border border-border bg-white p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-brand-black">
            Compliance Upcoming
          </h3>
          <p className="text-xs text-brand-gray-mid">Next 30 days</p>
        </div>
        <Link
          href="/dashboard/compliance"
          className="text-xs text-brand-red hover:underline"
        >
          View calendar →
        </Link>
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {items.map((item) => {
          const isOverdue  = item.status === "overdue";
          const isCritical = item.status === "critical";

          const Icon = isOverdue ? AlertTriangle : isCritical ? AlertTriangle : Clock;

          const iconCls = isOverdue
            ? "text-red-600 bg-red-50"
            : isCritical
            ? "text-amber-600 bg-amber-50"
            : "text-blue-600 bg-blue-50";

          const daysCls = isOverdue
            ? "text-red-600 font-semibold"
            : isCritical
            ? "text-amber-600 font-semibold"
            : "text-brand-gray-mid";

          const daysLabel =
            item.days_remaining < 0
              ? `${Math.abs(item.days_remaining)}d overdue`
              : item.days_remaining === 0
              ? "Due today"
              : `Due in ${item.days_remaining}d`;

          return (
            <div key={item.title} className="flex items-center gap-3">
              {/* Icon */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconCls}`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-brand-black truncate">
                  {item.title}
                </p>
                <p className="text-[10px] text-brand-gray-mid">{item.due_date}</p>
              </div>

              {/* Days label */}
              <span className={`text-xs whitespace-nowrap ${daysCls}`}>
                {daysLabel}
              </span>
            </div>
          );
        })}
      </div>

      {/* Compliance score footer */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs text-brand-gray-mid">
            Compliance score FY 2025-26
          </span>
        </div>
        <span className="text-xs font-bold text-brand-black">8 / 10</span>
      </div>
    </div>
  );
}
