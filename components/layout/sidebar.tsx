"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { CompanySwitcher } from "./company-switcher";
import type { Database, UserPermissions } from "@/types/database";
import { ROLE_LABELS } from "@/lib/roles";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Upload, CalendarCheck, CheckSquare,
  TrendingDown, TrendingUp, FileText, Bell, LogOut,
  Building2, ShieldCheck, X, Landmark, LayoutGrid, FolderOpen, Brain,
  Wallet, ScrollText, ArrowRightLeft, Send, Users, Ship, Target,
  Briefcase, GitBranch, UserPlus, ListChecks, Sparkles, BarChart3, Package, Mail, CalendarDays,
  ChevronDown, ChevronRight, Coins, ClipboardCheck, Database as DatabaseIcon,
} from "lucide-react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

type NavItem = {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  /** Permission key controlling visibility. `null` = always visible to anyone with dashboard access. */
  permKey: keyof UserPermissions | null;
  /** If true, route matches only on exact path (used for index routes). */
  exact?:  boolean;
};

type NavGroup = {
  id:      string;
  label:   string;
  icon:    React.ElementType;
  items:   NavItem[];
  /** If true, this group renders only when CEO/admin. */
  adminOnly?: boolean;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Sidebar information architecture
 *
 * Items are grouped into 6 collapsible sections (plus the NBD/Sales OS
 * section and two pinned items at the bottom: All Companies + Admin).
 *
 * Why grouped: a 17-item flat list was hard to scan, especially on the
 * iPhone PWA where vertical real-estate is tight. Now each group surfaces
 * 2-5 related items; only the active group needs to be open at a time.
 *
 * Auto-expand rule: a group expands automatically when the current route
 * matches one of its items. Otherwise the user's last collapsed/expanded
 * state is restored from localStorage on next page load.
 * ────────────────────────────────────────────────────────────────────── */
const NAV_GROUPS: NavGroup[] = [
  {
    id:    "overview",
    label: "Overview",
    icon:  LayoutDashboard,
    items: [
      { href: "/dashboard",       label: "CFO Dashboard",     icon: LayoutDashboard, permKey: "view_dashboard", exact: true },
      { href: "/dashboard/intel", label: "Intelligence Hub",  icon: Brain,           permKey: null },
    ],
  },
  {
    // CRR = Customer Retention / existing-business. Houses the AI Sales
    // Coordinator and all its quantity/value targets (item, customer, category).
    id:    "crr",
    label: "CRR — Existing Business",
    icon:  Target,
    items: [
      { href: "/dashboard/sales",            label: "AI Sales Coordinator", icon: Target,     permKey: null, exact: true },
      { href: "/dashboard/sales/customers",  label: "Customer Targets",     icon: Users,      permKey: null },
      { href: "/dashboard/sales/items",      label: "Company Item Targets", icon: Package,    permKey: null },
      { href: "/dashboard/sales/categories", label: "Category Targets",     icon: LayoutGrid, permKey: null },
    ],
  },
  {
    id:    "money",
    label: "Money",
    icon:  Coins,
    items: [
      { href: "/dashboard/pnl",       label: "P&L Statement",   icon: ScrollText,      permKey: "view_dashboard" },
      { href: "/dashboard/cashflow",  label: "Cash Flow",        icon: ArrowRightLeft,  permKey: "view_dashboard" },
      { href: "/dashboard/expenses",  label: "Expense Tracker",  icon: Wallet,          permKey: "view_dashboard" },
    ],
  },
  {
    id:    "ar_ap",
    label: "Receivables & Payables",
    icon:  TrendingUp,
    items: [
      { href: "/dashboard/receivables", label: "Accounts Receivable", icon: TrendingUp,   permKey: "view_receivables" },
      { href: "/dashboard/payables",    label: "Accounts Payable",     icon: TrendingDown, permKey: "view_payables" },
      { href: "/dashboard/customers",   label: "Customers (Group)",    icon: Users,        permKey: "view_receivables" },
      { href: "/dashboard/reminders",   label: "Send Reminders",       icon: Send,         permKey: "view_receivables" },
    ],
  },
  {
    id:    "banking",
    label: "Banking & Trade",
    icon:  Landmark,
    items: [
      { href: "/dashboard/banking", label: "Bank Statements", icon: Landmark, permKey: "view_banking" },
      { href: "/dashboard/duties",  label: "Imports & Duties", icon: Ship,    permKey: "view_dashboard" },
    ],
  },
  {
    id:    "compliance",
    label: "Compliance & Tasks",
    icon:  ClipboardCheck,
    items: [
      { href: "/dashboard/compliance", label: "Compliance Calendar", icon: CalendarCheck, permKey: "view_compliance" },
      { href: "/dashboard/tasks",      label: "Task Management",      icon: CheckSquare,   permKey: "manage_tasks" },
      { href: "/dashboard/alerts",     label: "Alerts",               icon: Bell,          permKey: "view_alerts" },
      { href: "/dashboard/review",     label: "Review Engine",        icon: FileText,      permKey: "view_review" },
    ],
  },
  {
    id:    "data",
    label: "Data",
    icon:  DatabaseIcon,
    items: [
      { href: "/dashboard/import",   label: "Import Data",   icon: Upload,     permKey: "import_data" },
      { href: "/dashboard/imports",  label: "Imported Data", icon: FolderOpen, permKey: "import_data" },
      { href: "/dashboard/contacts", label: "Contacts",       icon: Users,      permKey: "view_dashboard" },
    ],
  },
];

/**
 * NBD (New Business Development) sub-tabs — the whole Sales OS, grouped under
 * one collapsible parent and ordered along the lead → conversion journey.
 */
const NBD_ITEMS: { href: string; label: string; icon: React.ElementType; exact?: boolean }[] = [
  { href: "/dashboard/sales-os",            label: "Dashboard",          icon: LayoutDashboard, exact: true },
  { href: "/dashboard/sales-os/leads",      label: "Leads",              icon: UserPlus },
  { href: "/dashboard/sales-os/pipeline",   label: "Pipeline",           icon: GitBranch },
  { href: "/dashboard/sales-os/activities", label: "Follow-ups",         icon: ListChecks },
  { href: "/dashboard/sales-os/calendar",   label: "Calendar",           icon: CalendarDays },
  { href: "/dashboard/sales-os/accounts",   label: "Accounts",           icon: Building2 },
  { href: "/dashboard/sales-os/products",   label: "Products",           icon: Package },
  { href: "/dashboard/sales-os/quotes",     label: "Quotations",         icon: FileText },
  { href: "/dashboard/sales-os/email",      label: "Email",              icon: Mail },
  { href: "/dashboard/sales-os/ai",         label: "AI Sales Coach",     icon: Sparkles },
  { href: "/dashboard/sales-os/analytics",  label: "Reports & Analytics", icon: BarChart3 },
];

/**
 * "Sales Coordinator" used to be a top-level item; we keep it as a quick link
 * inside the Sales OS group rather than its own row to keep the sidebar tight.
 */
const SALES_COORD: NavItem = {
  href: "/dashboard/sales", label: "Sales Coordinator", icon: Target, permKey: null,
};

interface SidebarProps {
  profile: UserRow;
}

/** Returns true when the route should mark the item as active. */
function isItemActive(pathname: string, item: { href: string; exact?: boolean }): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname   = usePathname();
  const { isOpen, close } = useSidebar();

  // Filter helper — applies the same permission rules used previously.
  function canSee(item: NavItem): boolean {
    if (item.permKey === null) return true;
    // view_banking / view_crm: show if true OR if the key doesn't exist yet
    // (these were added after some users were created — default-visible).
    if (item.permKey === "view_banking" || item.permKey === "view_crm") {
      return profile.permissions?.[item.permKey] !== false;
    }
    return profile.permissions?.[item.permKey] === true;
  }

  // Compute visible groups + their visible items
  const visibleGroups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const showNbd = profile.permissions?.view_crm !== false;
  const onNbd   = pathname.startsWith("/dashboard/sales-os") || pathname === SALES_COORD.href;

  // Persist + restore group open/closed state. Active group auto-expands on
  // first paint and any time the user navigates into one of its routes.
  const STORAGE_KEY = "finos-sidebar-groups-v1";
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    // Pre-compute on first render so we don't flash a collapsed sidebar.
    const initial: Record<string, boolean> = {};
    for (const g of visibleGroups) {
      initial[g.id] = g.items.some((it) => isItemActive(pathname, it));
    }
    if (showNbd) initial.nbd = onNbd;
    return initial;
  });

  // Hydrate from localStorage AFTER first paint — preserves the user's
  // expand/collapse choices across page loads while keeping the active
  // group expanded.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, boolean>;
      setOpenGroups((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(saved)) {
          // Always force the active group to be open, regardless of saved pref.
          const grp = visibleGroups.find((g) => g.id === id);
          const isActive = grp ? grp.items.some((it) => isItemActive(pathname, it)) : (id === "nbd" ? onNbd : false);
          next[id] = isActive ? true : saved[id];
        }
        return next;
      });
    } catch { /* localStorage may be unavailable in some contexts */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whenever the user toggles a group
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups)); }
    catch { /* ignore */ }
  }, [openGroups]);

  function toggleGroup(id: string) {
    setOpenGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  const isAdmin = profile.permissions?.admin_users === true;

  return (
    <aside
      className={cn(
        // Mobile: fixed slide-in panel
        "fixed inset-y-0 left-0 z-30 w-72 sm:w-64 bg-brand-black flex flex-col transition-transform duration-300 ease-in-out",
        // PWA safe-area: keep logo below iOS notch + sign-out above home indicator
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        // Desktop: static in layout flow (body padding handles safe area)
        "lg:static lg:translate-x-0 lg:z-auto lg:w-64 lg:pt-0 lg:pb-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo + mobile close button */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Robotek FinOS</p>
            <p className="text-white/50 text-xs">Finance OS</p>
          </div>
        </div>
        <button
          onClick={close}
          className="lg:hidden text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <CompanySwitcher />

      {/* Nav groups */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleGroups.map((g) => {
          const isOpenGroup = !!openGroups[g.id];
          const groupActive = g.items.some((it) => isItemActive(pathname, it));

          return (
            <div key={g.id} className="mb-0.5">
              <button
                onClick={() => toggleGroup(g.id)}
                aria-expanded={isOpenGroup}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors",
                  groupActive ? "text-white" : "text-white/40 hover:text-white/70",
                )}
              >
                <g.icon className={cn("w-3.5 h-3.5 shrink-0", groupActive ? "text-brand-red" : "")} />
                <span className="flex-1 text-left">{g.label}</span>
                {isOpenGroup
                  ? <ChevronDown className="w-3.5 h-3.5" />
                  : <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              {isOpenGroup && (
                <div className="mt-0.5 space-y-0.5">
                  {g.items.map((item) => {
                    const active = isItemActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={close}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          active
                            ? "bg-brand-red text-white font-medium"
                            : "text-white/70 hover:text-white hover:bg-white/10",
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── NBD (Sales OS) — its own collapsible group ── */}
        {showNbd && (
          <div className="mb-0.5">
            <button
              onClick={() => toggleGroup("nbd")}
              aria-expanded={!!openGroups.nbd}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors",
                onNbd ? "text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              <Briefcase className={cn("w-3.5 h-3.5 shrink-0", onNbd ? "text-brand-red" : "")} />
              <span className="flex-1 text-left">NBD / Sales OS</span>
              {openGroups.nbd
                ? <ChevronDown className="w-3.5 h-3.5" />
                : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {openGroups.nbd && (
              <div className="mt-0.5 space-y-0.5">
                {/* Legacy Sales Coordinator entry — pinned at the top of this group */}
                <Link
                  key={SALES_COORD.href}
                  href={SALES_COORD.href}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    pathname === SALES_COORD.href || pathname.startsWith(SALES_COORD.href + "/")
                      ? "bg-brand-red text-white font-medium"
                      : "text-white/70 hover:text-white hover:bg-white/10",
                  )}
                >
                  <SALES_COORD.icon className="w-4 h-4 shrink-0" />
                  {SALES_COORD.label}
                </Link>
                {NBD_ITEMS.map((item) => {
                  const active = isItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        active
                          ? "bg-brand-red text-white font-medium"
                          : "text-white/70 hover:text-white hover:bg-white/10",
                      )}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* All Companies consolidated link — CEO/CFO. Pinned, not in a group. */}
        {(isAdmin || profile.role === "cfo") && (
          <>
            <div className="my-2 border-t border-white/10" />
            <Link
              href="/dashboard/consolidated"
              onClick={close}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname.startsWith("/dashboard/consolidated")
                  ? "bg-brand-yellow text-brand-black font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              All Companies
            </Link>
          </>
        )}

        {/* Admin link — pinned */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-white/10" />
            <Link
              href="/dashboard/admin"
              onClick={close}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname.startsWith("/dashboard/admin")
                  ? "bg-brand-red text-white font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10",
              )}
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      {/* User profile + sign out */}
      <div className="p-4 border-t border-white/10">
        <Link
          href="/dashboard/profile"
          onClick={close}
          className="flex items-center gap-3 mb-3 hover:bg-white/10 rounded-lg px-2 py-1.5 -mx-2 -my-1.5 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold uppercase">
              {profile.full_name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate group-hover:text-brand-yellow transition-colors">{profile.full_name}</p>
            <p className="text-white/50 text-xs truncate">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </p>
          </div>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-white/60 hover:text-white text-xs transition-colors w-full mt-1"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
