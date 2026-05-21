"use client";

/**
 * ComplianceContent — interactive compliance list with:
 *   - Category filter pills
 *   - Items grouped: Overdue → Due this week → This month → Upcoming → Completed
 *   - Mark as Filed / Paid inline dialog
 *   - Mini calendar sidebar (desktop)
 */

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle, CheckCircle2, Clock, CalendarDays,
  ChevronDown, ChevronUp, FileText, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/compliance/status-badge";
import { MiniCalendar } from "@/components/compliance/mini-calendar";
import { updateComplianceStatus } from "@/app/actions/compliance";
import {
  type ComplianceItem,
  type ComplianceCategoryId,
  type ComplianceStatus,
  CATEGORY_META,
  ALL_CATEGORIES,
  daysFromToday,
  fmtDate,
  computeComplianceScore,
} from "@/lib/compliance-data";

const TODAY = "2026-05-21";

interface Props {
  items: ComplianceItem[];
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ComplianceContent({ items: initialItems }: Props) {
  const [items, setItems]         = useState<ComplianceItem[]>(initialItems);
  const [catFilter, setCatFilter] = useState<ComplianceCategoryId | "All">("All");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ completed: true });
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [markDialog, setMarkDialog] = useState<ComplianceItem | null>(null);
  const [filedDate, setFiledDate]   = useState(TODAY);
  const [ackNumber, setAckNumber]   = useState("");
  const [markNotes, setMarkNotes]   = useState("");
  const [isPending, startTransition] = useTransition();

  // ── Filtering ─────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = catFilter === "All" ? items : items.filter((i) => i.category === catFilter);
    if (selectedDate) list = list.filter((i) => i.due_date === selectedDate);
    return list;
  }, [items, catFilter, selectedDate]);

  // ── Grouping ──────────────────────────────────────────────────────────────
  const groups = useMemo(() => {
    const sevenDaysOut = new Date(new Date(TODAY).getTime() + 7 * 86_400_000)
      .toISOString().split("T")[0];
    const endOfMonth = new Date(2026, 4, 31).toISOString().split("T")[0]; // May 31

    const overdue:    ComplianceItem[] = [];
    const thisWeek:   ComplianceItem[] = [];
    const thisMonth:  ComplianceItem[] = [];
    const upcoming:   ComplianceItem[] = [];
    const completed:  ComplianceItem[] = [];

    filtered.forEach((item) => {
      if (item.status === "filed" || item.status === "paid") {
        completed.push(item);
      } else if (item.status === "overdue" || (item.due_date < TODAY && item.status === "pending")) {
        overdue.push(item);
      } else if (item.due_date <= sevenDaysOut) {
        thisWeek.push(item);
      } else if (item.due_date <= endOfMonth) {
        thisMonth.push(item);
      } else {
        upcoming.push(item);
      }
    });

    // Sort each group by due_date ascending, except completed (by filed desc)
    const byDue = (a: ComplianceItem, b: ComplianceItem) =>
      a.due_date.localeCompare(b.due_date);
    const byFiledDesc = (a: ComplianceItem, b: ComplianceItem) =>
      (b.filed_date ?? "").localeCompare(a.filed_date ?? "");

    return {
      overdue:    overdue.sort(byDue),
      thisWeek:   thisWeek.sort(byDue),
      thisMonth:  thisMonth.sort(byDue),
      upcoming:   upcoming.sort(byDue),
      completed:  completed.sort(byFiledDesc),
    };
  }, [filtered]);

  const score = computeComplianceScore(items, TODAY);

  // ── Mark as filed/paid ────────────────────────────────────────────────────
  const openMarkDialog = (item: ComplianceItem) => {
    setMarkDialog(item);
    setFiledDate(TODAY);
    setAckNumber("");
    setMarkNotes("");
  };

  const submitMark = (newStatus: ComplianceStatus) => {
    if (!markDialog) return;
    startTransition(async () => {
      const result = await updateComplianceStatus({
        id: markDialog.id,
        status: newStatus,
        filed_date: filedDate || undefined,
        acknowledgement_number: ackNumber || undefined,
        notes: markNotes || undefined,
      });
      if (result.success) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === markDialog.id
              ? { ...i, status: newStatus, filed_date: filedDate || null, acknowledgement_number: ackNumber || null, notes: markNotes || i.notes }
              : i
          )
        );
        setMarkDialog(null);
      }
    });
  };

  const toggleSection = (key: string) =>
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  // ── Compliance score color ────────────────────────────────────────────────
  const scoreColor = score >= 90 ? "text-green-700" : score >= 70 ? "text-amber-700" : "text-red-700";
  const scoreBg    = score >= 90 ? "bg-green-50 border-green-200" : score >= 70 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className="space-y-5">

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total FY Items" value={items.length} className="bg-white border-border" />
        <StatCard label="Overdue" value={groups.overdue.length} className="bg-red-50 border-red-200 text-red-700" />
        <StatCard label="Due This Week" value={groups.thisWeek.length} className="bg-amber-50 border-amber-200 text-amber-700" />
        <div className={`rounded-xl border p-4 ${scoreBg}`}>
          <p className="text-xs text-brand-gray-mid mb-1">Compliance Score</p>
          <p className={`text-2xl font-bold ${scoreColor}`}>{score}%</p>
          <p className="text-xs text-brand-gray-mid mt-0.5">
            {groups.completed.length} of {items.filter(i => i.due_date <= TODAY).length} past-due filed
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Left: list ───────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-2">
            <FilterPill label="All" active={catFilter === "All"} onClick={() => { setCatFilter("All"); setSelectedDate(undefined); }} />
            {ALL_CATEGORIES.map((cat) => {
              const count = items.filter(i => i.category === cat).length;
              return (
                <FilterPill
                  key={cat}
                  label={`${CATEGORY_META[cat].icon} ${CATEGORY_META[cat].label}`}
                  count={count}
                  active={catFilter === cat}
                  onClick={() => { setCatFilter(cat); setSelectedDate(undefined); }}
                />
              );
            })}
          </div>

          {selectedDate && (
            <div className="flex items-center gap-2 text-sm text-brand-gray-mid bg-brand-gray-light rounded-lg px-3 py-2">
              <CalendarDays className="w-4 h-4" />
              Showing items due {fmtDate(selectedDate)}
              <button onClick={() => setSelectedDate(undefined)} className="ml-auto text-xs underline hover:text-brand-black">
                Clear
              </button>
            </div>
          )}

          {/* Grouped sections */}
          <ComplianceSection
            title="Overdue"
            icon={<AlertTriangle className="w-4 h-4 text-red-600" />}
            headerClass="bg-red-50 border-red-200"
            titleClass="text-red-800"
            items={groups.overdue}
            collapsed={collapsed["overdue"] ?? false}
            onToggle={() => toggleSection("overdue")}
            onMark={openMarkDialog}
          />
          <ComplianceSection
            title="Due This Week"
            icon={<Clock className="w-4 h-4 text-amber-600" />}
            headerClass="bg-amber-50 border-amber-200"
            titleClass="text-amber-800"
            items={groups.thisWeek}
            collapsed={collapsed["thisWeek"] ?? false}
            onToggle={() => toggleSection("thisWeek")}
            onMark={openMarkDialog}
          />
          <ComplianceSection
            title="Due This Month"
            icon={<CalendarDays className="w-4 h-4 text-blue-600" />}
            headerClass="bg-blue-50 border-blue-200"
            titleClass="text-blue-800"
            items={groups.thisMonth}
            collapsed={collapsed["thisMonth"] ?? false}
            onToggle={() => toggleSection("thisMonth")}
            onMark={openMarkDialog}
          />
          <ComplianceSection
            title="Upcoming"
            icon={<CalendarDays className="w-4 h-4 text-brand-gray-mid" />}
            headerClass="bg-brand-gray-light border-border"
            titleClass="text-brand-black"
            items={groups.upcoming}
            collapsed={collapsed["upcoming"] ?? false}
            onToggle={() => toggleSection("upcoming")}
            onMark={openMarkDialog}
          />
          <ComplianceSection
            title="Completed"
            icon={<CheckCircle2 className="w-4 h-4 text-green-600" />}
            headerClass="bg-green-50 border-green-200"
            titleClass="text-green-800"
            items={groups.completed}
            collapsed={collapsed["completed"] ?? true}
            onToggle={() => toggleSection("completed")}
            onMark={openMarkDialog}
          />
        </div>

        {/* ── Right: mini calendar (desktop) ───────────────────────── */}
        <div className="hidden lg:block w-64 xl:w-72 shrink-0">
          <MiniCalendar
            items={items}
            initialYear={2026}
            initialMonth={5}
            selectedDate={selectedDate}
            onSelectDate={(d) => setSelectedDate(d === selectedDate ? undefined : d)}
          />
        </div>
      </div>

      {/* ── Mark Filed / Paid dialog ──────────────────────────────────── */}
      {markDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMarkDialog(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4">
            <div>
              <h3 className="text-base font-bold text-brand-black">Mark as Filed / Paid</h3>
              <p className="text-sm text-brand-gray-mid mt-0.5">
                {markDialog.title} — {markDialog.period}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-brand-black mb-1">
                  {markDialog.category === "TDS" || markDialog.category === "TCS" ||
                   markDialog.category === "PF" || markDialog.category === "ESI" ||
                   markDialog.category === "AdvanceTax"
                    ? "Payment Date" : "Filing Date"}
                </label>
                <input
                  type="date"
                  value={filedDate}
                  onChange={(e) => setFiledDate(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-black mb-1">
                  Acknowledgement / Reference Number <span className="text-brand-gray-mid font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="ARN / BSR / Challan no."
                  value={ackNumber}
                  onChange={(e) => setAckNumber(e.target.value)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-black mb-1">
                  Notes <span className="text-brand-gray-mid font-normal">(optional)</span>
                </label>
                <textarea
                  placeholder="Any remarks..."
                  value={markNotes}
                  onChange={(e) => setMarkNotes(e.target.value)}
                  rows={2}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setMarkDialog(null)}>
                Cancel
              </Button>
              {/* Choose filed vs paid based on category */}
              {["TDS", "TCS", "PF", "ESI", "AdvanceTax", "ProfTax"].includes(markDialog.category) ? (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => submitMark("paid")}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark as Paid"}
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => submitMark("filed")}
                  disabled={isPending}
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark as Filed"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label, value, className,
}: { label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}>
      <p className="text-xs text-brand-gray-mid mb-1">{label}</p>
      <p className="text-2xl font-bold text-brand-black">{value}</p>
    </div>
  );
}

function FilterPill({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
        active
          ? "bg-brand-red text-white border-brand-red"
          : "bg-white text-brand-gray-mid border-border hover:border-brand-red/40 hover:text-brand-black"
      }`}
    >
      {label}{count !== undefined && ` (${count})`}
    </button>
  );
}

function ComplianceSection({
  title, icon, headerClass, titleClass, items, collapsed, onToggle, onMark,
}: {
  title: string;
  icon: React.ReactNode;
  headerClass: string;
  titleClass: string;
  items: ComplianceItem[];
  collapsed: boolean;
  onToggle: () => void;
  onMark: (item: ComplianceItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 border-b border-border ${headerClass}`}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className={`text-sm font-semibold ${titleClass}`}>{title}</span>
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${titleClass} bg-white/60`}>
            {items.length}
          </span>
        </div>
        {collapsed
          ? <ChevronDown className="w-4 h-4 text-brand-gray-mid" />
          : <ChevronUp   className="w-4 h-4 text-brand-gray-mid" />
        }
      </button>

      {!collapsed && (
        <div className="divide-y divide-border bg-white">
          {items.map((item) => (
            <ComplianceRow key={item.id} item={item} onMark={onMark} />
          ))}
        </div>
      )}
    </div>
  );
}

function ComplianceRow({
  item, onMark,
}: { item: ComplianceItem; onMark: (item: ComplianceItem) => void }) {
  const days      = daysFromToday(item.due_date, TODAY);
  const isOverdue = days < 0;
  const isDone    = item.status === "filed" || item.status === "paid";
  const meta      = CATEGORY_META[item.category];

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-brand-gray-light/40 transition-colors">
      {/* Category chip */}
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${meta.bg} ${meta.text} ${meta.border}`}>
        {meta.icon} {meta.label}
      </span>

      {/* Title + period */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/dashboard/compliance/${item.id}`}
          className="text-sm font-semibold text-brand-black hover:text-brand-red transition-colors"
        >
          {item.title}
        </Link>
        <p className="text-xs text-brand-gray-mid truncate">{item.period}</p>
      </div>

      {/* Due date + days badge */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right hidden sm:block">
          <p className="text-xs font-medium text-brand-black">{fmtDate(item.due_date)}</p>
          {!isDone && (
            <p className={`text-[10px] font-medium ${isOverdue ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-brand-gray-mid"}`}>
              {isOverdue ? `${Math.abs(days)} days overdue` : days === 0 ? "Due today!" : `${days} days left`}
            </p>
          )}
        </div>

        <StatusBadge status={item.status} size="sm" />

        {/* Actions */}
        {isDone ? (
          <Link
            href={`/dashboard/compliance/${item.id}`}
            className="text-xs text-brand-gray-mid hover:text-brand-black flex items-center gap-1"
          >
            <FileText className="w-3 h-3" /> View
          </Link>
        ) : (
          <button
            onClick={() => onMark(item)}
            className="text-xs font-medium text-green-700 hover:text-green-900 border border-green-200 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
          >
            {["TDS", "TCS", "PF", "ESI", "AdvanceTax", "ProfTax"].includes(item.category)
              ? "Mark Paid" : "Mark Filed"}
          </button>
        )}
      </div>
    </div>
  );
}
