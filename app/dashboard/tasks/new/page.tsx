"use client";

/**
 * New Task Page — Module 4
 *
 * Clean mobile-first form. Assign-to uses a searchable combobox that always
 * resolves to a real team-member UUID — no free-text manual entry that breaks
 * the UUID column in the DB.
 *
 * Fixes:
 *   - "invalid input syntax for type uuid" crash (manual name stored in UUID col)
 *   - Submit button hidden below fold on mobile
 *   - Enter-manually mode removed; typing filters the team list instead
 */

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { createTask } from "@/app/actions/tasks";
import { getTeamUsers, type TeamUser } from "@/app/actions/users";
import { ArrowLeft, Loader2, CheckCircle2, Search, X } from "lucide-react";
import type { TaskPriority, TaskModule } from "@/lib/tasks-data";
import { ROLE_LABELS } from "@/lib/roles";

const MODULES: { value: TaskModule; label: string }[] = [
  { value: "compliance",  label: "Compliance" },
  { value: "payables",    label: "Accounts Payable" },
  { value: "receivables", label: "Accounts Receivable" },
  { value: "import",      label: "Data Import" },
  { value: "review",      label: "Review Engine" },
  { value: "general",     label: "General" },
];

const PRIORITIES: { value: TaskPriority; label: string; dot: string }[] = [
  { value: "urgent", label: "Urgent", dot: "🔴" },
  { value: "high",   label: "High",   dot: "🟠" },
  { value: "medium", label: "Medium", dot: "🟡" },
  { value: "low",    label: "Low",    dot: "⚪" },
];

export default function NewTaskPage() {
  const router  = useRouter();
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess]        = useState(false);

  const [title,    setTitle]    = useState("");
  const [desc,     setDesc]     = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [module,   setModule]   = useState<TaskModule>("general");
  const [dueDate,  setDueDate]  = useState("");
  const [errors,   setErrors]   = useState<string[]>([]);

  // Assign-to combobox state
  const [teamUsers,     setTeamUsers]     = useState<TeamUser[]>([]);
  const [loadingUsers,  setLoadingUsers]  = useState(true);
  const [searchText,    setSearchText]    = useState("");       // what user typed
  const [selectedUser,  setSelectedUser]  = useState<TeamUser | null>(null);
  const [dropdownOpen,  setDropdownOpen]  = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // Load team members
  useEffect(() => {
    getTeamUsers()
      .then((users) => { setTeamUsers(users); setLoadingUsers(false); })
      .catch(() => setLoadingUsers(false));
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  /** Filtered list based on what the user typed */
  const filtered = teamUsers.filter((u) =>
    !searchText ||
    u.full_name.toLowerCase().includes(searchText.toLowerCase()) ||
    (ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role)
      .toLowerCase().includes(searchText.toLowerCase())
  );

  function handleSelectUser(u: TeamUser) {
    setSelectedUser(u);
    setSearchText("");
    setDropdownOpen(false);
  }

  function clearSelection() {
    setSelectedUser(null);
    setSearchText("");
  }

  function handleComboInput(val: string) {
    setSearchText(val);
    setSelectedUser(null);   // clear selection when typing again
    setDropdownOpen(true);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: string[] = [];
    if (!title.trim()) newErrors.push("Title is required");
    if (newErrors.length) { setErrors(newErrors); return; }
    setErrors([]);

    startTransition(async () => {
      const result = await createTask({
        title:               title.trim(),
        description:         desc.trim() || undefined,
        priority,
        module,
        due_date:            dueDate || undefined,
        // Only pass the UUID — never a raw name string
        assigned_to_user_id: selectedUser?.id ?? undefined,
      });
      if (result.success) {
        setSuccess(true);
        setTimeout(() => router.push("/dashboard/tasks"), 1500);
      } else {
        setErrors([result.message]);
      }
    });
  };

  if (success) {
    return (
      <>
        <Header title="New Task" breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Tasks", href: "/dashboard/tasks" }, { label: "New Task" }]} showImport={false} />
        <main className="flex-1 p-4 sm:p-6">
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center space-y-3 max-w-lg mx-auto mt-8">
            <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
            <p className="font-semibold text-green-800">Task created successfully!</p>
            <p className="text-sm text-green-700">Redirecting to task list…</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header
        title="New Task"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Tasks",     href: "/dashboard/tasks" },
          { label: "New Task" },
        ]}
        showImport={false}
      />

      <main className="flex-1 p-4 sm:p-6 pb-24 sm:pb-6 max-w-2xl">
        <Link
          href="/dashboard/tasks"
          className="inline-flex items-center gap-1 text-sm text-brand-gray-mid hover:text-brand-black mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Tasks
        </Link>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-border p-4 sm:p-6 space-y-5">
          <h2 className="text-base font-bold text-brand-black">Create a New Task</h2>

          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {errors.map((e) => <p key={e} className="text-sm text-red-700">{e}</p>)}
            </div>
          )}

          {/* ── Title ─────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. File TDS Return Q1 FY26-27"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 bg-white"
            />
          </div>

          {/* ── Description ───────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">
              Description <span className="text-brand-gray-mid font-normal text-[11px]">(optional)</span>
            </label>
            <textarea
              placeholder="Additional context, steps, links..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none bg-white"
            />
          </div>

          {/* ── Assign To — searchable combobox ───────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">
              Assign To <span className="text-brand-gray-mid font-normal text-[11px]">(optional)</span>
            </label>

            <div ref={comboRef} className="relative">
              {/* Input — shows selected user or search text */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-mid pointer-events-none" />
                <input
                  type="text"
                  placeholder={loadingUsers ? "Loading team…" : "Search team member…"}
                  disabled={loadingUsers}
                  value={selectedUser ? selectedUser.full_name : searchText}
                  onChange={(e) => handleComboInput(e.target.value)}
                  onFocus={() => !selectedUser && setDropdownOpen(true)}
                  className="w-full text-sm border border-border rounded-lg pl-9 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 bg-white disabled:opacity-50"
                />
                {/* Clear button */}
                {(selectedUser || searchText) && (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-gray-mid hover:text-brand-black"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dropdown suggestions */}
              {dropdownOpen && !selectedUser && (
                <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-brand-gray-mid px-4 py-3">
                      {searchText ? `No team member matches "${searchText}"` : "No team members found"}
                    </p>
                  ) : (
                    filtered.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); handleSelectUser(u); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors text-left"
                      >
                        <div className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center shrink-0">
                          <span className="text-white text-[11px] font-bold uppercase">
                            {u.full_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-brand-black truncate">{u.full_name}</p>
                          <p className="text-xs text-brand-gray-mid">
                            {ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected user chip */}
            {selectedUser && (
              <div className="mt-2 inline-flex items-center gap-2 bg-brand-red/5 border border-brand-red/20 text-brand-red text-xs font-medium px-3 py-1.5 rounded-full">
                <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold uppercase">{selectedUser.full_name.charAt(0)}</span>
                </div>
                {selectedUser.full_name}
                <button type="button" onClick={clearSelection} className="ml-0.5 hover:text-brand-maroon">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* ── Priority ──────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {PRIORITIES.map(({ value, label, dot }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPriority(value)}
                  className={`text-sm font-medium px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    priority === value
                      ? "border-brand-red bg-brand-red/5 text-brand-red ring-1 ring-brand-red/30"
                      : "border-border bg-white text-brand-gray-mid hover:border-brand-red/30"
                  }`}
                >
                  <span>{dot}</span> {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Module ────────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">Module</label>
            <select
              value={module}
              onChange={(e) => setModule(e.target.value as TaskModule)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 bg-white"
            >
              {MODULES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* ── Due Date ──────────────────────────────────────────── */}
          <div>
            <label className="block text-xs font-semibold text-brand-black mb-1.5">
              Due Date <span className="text-brand-gray-mid font-normal text-[11px]">(optional)</span>
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-sm border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-red/30 bg-white"
            />
          </div>

          {/* ── Submit ────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              className="flex-1 sm:flex-none bg-brand-red hover:bg-brand-maroon text-white font-semibold"
              disabled={isPending}
            >
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating…</>
                : "Create Task"
              }
            </Button>
            <Link href="/dashboard/tasks" className="flex-1 sm:flex-none">
              <Button type="button" variant="outline" className="w-full">Cancel</Button>
            </Link>
          </div>
        </form>
      </main>
    </>
  );
}
