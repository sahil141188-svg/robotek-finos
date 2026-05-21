"use client";

/**
 * MiniCalendar — compact month grid showing compliance due dates as colored dots.
 * Navigate prev/next month. Clicking a date calls onSelectDate.
 */

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  type ComplianceItem,
  CATEGORY_META,
  type ComplianceCategoryId,
} from "@/lib/compliance-data";

interface MiniCalendarProps {
  items: ComplianceItem[];
  initialYear?: number;
  initialMonth?: number; // 1-12
  onSelectDate?: (dateStr: string) => void;
  selectedDate?: string;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

export function MiniCalendar({
  items,
  initialYear = 2026,
  initialMonth = 5,
  onSelectDate,
  selectedDate,
}: MiniCalendarProps) {
  const [year, setYear]   = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 1-12

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  };

  // Build month grid
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().split("T")[0];
  const prefix = `${year}-${String(month).padStart(2, "0")}`;

  // Map: dateStr → unique categories that have items due
  const dateCategories = new Map<string, Set<ComplianceCategoryId>>();
  items.forEach((item) => {
    if (item.due_date.startsWith(prefix)) {
      const existing = dateCategories.get(item.due_date) ?? new Set<ComplianceCategoryId>();
      existing.add(item.category);
      dateCategories.set(item.due_date, existing);
    }
  });

  // Build grid cells: nulls for empty slots before/after month
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="bg-white rounded-xl border border-border p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-brand-gray-light transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-brand-gray-mid" />
        </button>
        <span className="text-sm font-semibold text-brand-black">
          {MONTH_NAMES[month - 1]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-brand-gray-light transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-brand-gray-mid" />
        </button>
      </div>

      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-brand-gray-mid py-0.5">
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;

          const dateStr = `${prefix}-${String(day).padStart(2, "0")}`;
          const cats    = dateCategories.get(dateStr);
          const isToday = dateStr === today;
          const isSel   = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate?.(dateStr)}
              className={`relative flex flex-col items-center py-1 rounded-lg transition-all ${
                isSel
                  ? "bg-brand-red text-white"
                  : isToday
                  ? "bg-brand-red/10 text-brand-red font-bold"
                  : "hover:bg-brand-gray-light text-brand-black"
              }`}
            >
              <span className="text-xs">{day}</span>

              {/* Colored category dots */}
              {cats && cats.size > 0 && (
                <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center max-w-[24px]">
                  {Array.from(cats).slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="w-1 h-1 rounded-full"
                      style={{ backgroundColor: getCatDotColor(cat) }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-[10px] font-medium text-brand-gray-mid mb-1.5 uppercase tracking-wide">Due dates</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {Object.entries(CATEGORY_META).map(([id, meta]) => (
            <div key={id} className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: getCatDotColor(id as ComplianceCategoryId) }}
              />
              <span className="text-[10px] text-brand-gray-mid truncate">{meta.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Map category → dot color (distinct colors for easy identification)
function getCatDotColor(cat: ComplianceCategoryId): string {
  const map: Record<ComplianceCategoryId, string> = {
    GST:        "#3B82F6", // blue
    TDS:        "#8B5CF6", // purple
    TCS:        "#6366F1", // indigo
    PF:         "#14B8A6", // teal
    ESI:        "#06B6D4", // cyan
    AdvanceTax: "#F97316", // orange
    ROC:        "#F43F5E", // rose
    IncomeTax:  "#F59E0B", // amber
    ProfTax:    "#84CC16", // lime
  };
  return map[cat] ?? "#9CA3AF";
}
