"use client";

import { useState } from "react";
import Link from "next/link";
import { ACTIVITY_TYPE_LABELS } from "@/lib/crm/types";
import type { CrmActivityType } from "@/types/database";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CalItem = {
  id: string;
  subject: string;
  due_at: string;
  type: CrmActivityType;
  done: boolean;
  context_label: string | null;
  context_href: string | null;
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CalendarView({ items, initialYear, initialMonth, todayKey }: {
  items: CalItem[]; initialYear: number; initialMonth: number; todayKey: string;
}) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth); // 0-based
  const [selected, setSelected] = useState<string | null>(todayKey);

  // Bucket items by local day.
  const byDay = new Map<string, CalItem[]>();
  for (const it of items) {
    const k = dayKey(new Date(it.due_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(it);
  }

  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  }

  const selectedItems = selected ? byDay.get(selected) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-black">{MONTHS[month]} {year}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} className="p-2 rounded-lg border border-border hover:bg-brand-gray-light"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setYear(initialYear); setMonth(initialMonth); setSelected(todayKey); }} className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-brand-gray-light">Today</button>
          <button onClick={() => shift(1)} className="p-2 rounded-lg border border-border hover:bg-brand-gray-light"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-brand-gray-light/50 text-[11px] text-brand-gray-mid font-medium">
          {DOW.map((d) => <div key={d} className="px-2 py-2 text-center">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[84px] border-b border-r border-border bg-brand-gray-light/20" />;
            const k = dayKey(d);
            const dayItems = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            const isSel = k === selected;
            const overdue = dayItems.some((it) => !it.done && k < todayKey);
            return (
              <button key={i} onClick={() => setSelected(k)}
                className={`min-h-[84px] border-b border-r border-border p-1.5 text-left align-top hover:bg-brand-gray-light/40 transition-colors ${isSel ? "bg-brand-red/5 ring-1 ring-inset ring-brand-red/30" : ""}`}>
                <div className={`text-xs font-medium mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${isToday ? "bg-brand-red text-white" : "text-brand-black"}`}>{d.getDate()}</div>
                <div className="space-y-0.5">
                  {dayItems.slice(0, 3).map((it) => (
                    <div key={it.id} className={`text-[10px] truncate rounded px-1 py-0.5 ${it.done ? "bg-brand-gray-light text-brand-gray-mid line-through" : overdue ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
                      {it.subject}
                    </div>
                  ))}
                  {dayItems.length > 3 && <div className="text-[10px] text-brand-gray-mid">+{dayItems.length - 3} more</div>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-brand-black mb-3">{selected ? new Date(selected).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : "Select a day"}</h3>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-brand-gray-mid">No follow-ups scheduled.</p>
        ) : (
          <div className="divide-y divide-border">
            {selectedItems.map((it) => (
              <div key={it.id} className="py-2.5 flex items-center justify-between text-sm">
                <div className={it.done ? "line-through text-brand-gray-mid" : ""}>
                  <span className="text-[10px] uppercase tracking-wide bg-brand-gray-light rounded px-1.5 py-0.5 mr-2 text-brand-gray-mid">{ACTIVITY_TYPE_LABELS[it.type]}</span>
                  <span className="text-brand-black">{it.subject}</span>
                </div>
                {it.context_label && (it.context_href
                  ? <Link href={it.context_href} className="text-xs text-brand-red hover:underline">{it.context_label}</Link>
                  : <span className="text-xs text-brand-gray-mid">{it.context_label}</span>)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
