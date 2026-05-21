"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";
import type { Database, UserPermissions } from "@/types/database";
import { ROLE_LABELS } from "@/lib/roles";
import {
  LayoutDashboard, Upload, CalendarCheck, CheckSquare,
  TrendingDown, TrendingUp, FileText, Bell, LogOut,
  Building2, ShieldCheck, X, Landmark,
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
  { href: "/dashboard/compliance",   label: "Compliance Calendar",   icon: CalendarCheck,   permKey: "view_compliance" },
  { href: "/dashboard/tasks",        label: "Task Management",       icon: CheckSquare,     permKey: "manage_tasks" },
  { href: "/dashboard/payables",     label: "Accounts Payable",      icon: TrendingDown,    permKey: "view_payables" },
  { href: "/dashboard/receivables",  label: "Accounts Receivable",   icon: TrendingUp,      permKey: "view_receivables" },
  { href: "/dashboard/banking",      label: "Bank Statements",       icon: Landmark,        permKey: "view_banking" },
  { href: "/dashboard/review",       label: "Review Engine",         icon: FileText,        permKey: "view_review" },
  { href: "/dashboard/alerts",       label: "Alerts",                icon: Bell,            permKey: "view_alerts" },
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
    // view_banking: show if permission is true OR if permission key doesn't exist yet (CEO default)
    if (item.permKey === "view_banking") {
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
        // Desktop: static in layout flow
        "lg:static lg:translate-x-0 lg:z-auto lg:w-64",
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
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold uppercase">
              {profile.full_name.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-white/50 text-xs truncate">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </p>
          </div>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-2 text-white/60 hover:text-white text-xs transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
