"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import { CompanySwitcher } from "./company-switcher";
import type { Database, UserPermissions } from "@/types/database";
import { ROLE_LABELS } from "@/lib/roles";
import {
  LayoutDashboard, Upload, CalendarCheck, CheckSquare,
  TrendingDown, TrendingUp, FileText, Bell, LogOut,
  Building2, ShieldCheck, X, Landmark, LayoutGrid, FolderOpen, Brain,
  Wallet, ScrollText, ArrowRightLeft, Send, Users, Ship, Target,
  Briefcase, GitBranch, UserPlus, ListChecks,
} from "lucide-react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/** Maps each nav item to the permission key that controls its visibility */
const NAV_ITEMS: {
  href:    string;
  label:   string;
  icon:    React.ElementType;
  permKey: keyof UserPermissions | null; // null = always visible
}[] = [
  { href: "/dashboard",              label: "CFO Dashboard",         icon: LayoutDashboard, permKey: "view_dashboard" },
  { href: "/dashboard/import",       label: "Import Data",           icon: Upload,          permKey: "import_data" },
  { href: "/dashboard/imports",      label: "Imported Data",         icon: FolderOpen,      permKey: "import_data" },
  { href: "/dashboard/compliance",   label: "Compliance Calendar",   icon: CalendarCheck,   permKey: "view_compliance" },
  { href: "/dashboard/tasks",        label: "Task Management",       icon: CheckSquare,     permKey: "manage_tasks" },
  { href: "/dashboard/payables",     label: "Accounts Payable",      icon: TrendingDown,    permKey: "view_payables" },
  { href: "/dashboard/receivables",  label: "Accounts Receivable",   icon: TrendingUp,      permKey: "view_receivables" },
  { href: "/dashboard/banking",      label: "Bank Statements",       icon: Landmark,        permKey: "view_banking" },
  { href: "/dashboard/expenses",     label: "Expense Tracker",       icon: Wallet,          permKey: "view_dashboard" },
  { href: "/dashboard/pnl",          label: "P&L Statement",         icon: ScrollText,      permKey: "view_dashboard" },
  { href: "/dashboard/cashflow",     label: "Cash Flow",             icon: ArrowRightLeft,  permKey: "view_dashboard" },
  { href: "/dashboard/duties",       label: "Imports & Duties",      icon: Ship,            permKey: "view_dashboard" },
  { href: "/dashboard/contacts",     label: "Contacts",              icon: Users,           permKey: "view_dashboard" },
  { href: "/dashboard/customers",    label: "Customers (Group)",     icon: Users,           permKey: "view_receivables" },
  { href: "/dashboard/reminders",    label: "Send Reminders",        icon: Send,            permKey: "view_receivables" },
  { href: "/dashboard/review",       label: "Review Engine",         icon: FileText,        permKey: "view_review" },
  { href: "/dashboard/alerts",       label: "Alerts",                icon: Bell,            permKey: "view_alerts" },
  { href: "/dashboard/sales",        label: "Sales Coordinator",     icon: Target,          permKey: null },
  { href: "/dashboard/sales-os",            label: "Sales OS",         icon: Briefcase,    permKey: "view_crm" },
  { href: "/dashboard/sales-os/leads",      label: "Leads",            icon: UserPlus,     permKey: "view_crm" },
  { href: "/dashboard/sales-os/pipeline",   label: "Pipeline",         icon: GitBranch,    permKey: "view_crm" },
  { href: "/dashboard/sales-os/accounts",   label: "Accounts",         icon: Building2,    permKey: "view_crm" },
  { href: "/dashboard/sales-os/activities", label: "Follow-ups",       icon: ListChecks,   permKey: "view_crm" },
  { href: "/dashboard/intel",        label: "Intelligence Hub",      icon: Brain,           permKey: null },
];

interface SidebarProps {
  profile: UserRow;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname   = usePathname();
  const { isOpen, close } = useSidebar();

  /** Filter nav items based on the user's actual permissions */
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.permKey === null) return true;
    // view_banking / view_crm: show if true OR if the key doesn't exist yet
    // (these were added after some users were created — default-visible).
    if (item.permKey === "view_banking" || item.permKey === "view_crm") {
      return profile.permissions?.[item.permKey] !== false;
    }
    return profile.permissions?.[item.permKey] === true;
  });

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
        {/* Close button — mobile only */}
        <button
          onClick={close}
          className="lg:hidden text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Company switcher — below logo */}
      <CompanySwitcher />

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={close} // close sidebar on nav on mobile
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-brand-red text-white font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        {/* All Companies consolidated link — CEO/CFO */}
        {(profile.permissions?.admin_users === true || profile.role === "cfo") && (
          <>
            <div className="my-2 border-t border-white/10" />
            <Link
              href="/dashboard/consolidated"
              onClick={close}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                pathname.startsWith("/dashboard/consolidated")
                  ? "bg-brand-yellow text-brand-black font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              )}
            >
              <LayoutGrid className="w-4 h-4 shrink-0" />
              All Companies
            </Link>
          </>
        )}

        {/* Admin link */}
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
                  : "text-white/70 hover:text-white hover:bg-white/10"
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
