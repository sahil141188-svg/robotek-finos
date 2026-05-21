"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";
import { cn } from "@/lib/utils";
import type { Database, UserPermissions } from "@/types/database";
import { ROLE_LABELS } from "@/lib/roles";
import {
  LayoutDashboard,
  Upload,
  CalendarCheck,
  CheckSquare,
  TrendingDown,
  TrendingUp,
  FileText,
  Bell,
  LogOut,
  Building2,
  ShieldCheck,
} from "lucide-react";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/** Maps each nav item to the permission key that controls its visibility */
const NAV_ITEMS: {
  href: string;
  label: string;
  icon: React.ElementType;
  permKey: keyof UserPermissions | null; // null = always visible
}[] = [
  { href: "/dashboard", label: "CFO Dashboard", icon: LayoutDashboard, permKey: "view_dashboard" },
  { href: "/dashboard/import", label: "Import Data", icon: Upload, permKey: "import_data" },
  { href: "/dashboard/compliance", label: "Compliance Calendar", icon: CalendarCheck, permKey: "view_compliance" },
  { href: "/dashboard/tasks", label: "Task Management", icon: CheckSquare, permKey: "manage_tasks" },
  { href: "/dashboard/payables", label: "Accounts Payable", icon: TrendingDown, permKey: "view_payables" },
  { href: "/dashboard/receivables", label: "Accounts Receivable", icon: TrendingUp, permKey: "view_receivables" },
  { href: "/dashboard/review", label: "Review Engine", icon: FileText, permKey: "view_review" },
  { href: "/dashboard/alerts", label: "Alerts", icon: Bell, permKey: "view_alerts" },
];

interface SidebarProps {
  profile: UserRow;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();

  /** Filter nav items based on the user's actual permissions */
  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.permKey === null) return true;
    return profile.permissions?.[item.permKey] === true;
  });

  const isAdmin = profile.permissions?.admin_users === true;

  return (
    <aside className="w-64 min-h-screen bg-brand-black flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-red flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-tight">Robotek FinOS</p>
            <p className="text-white/50 text-xs">Finance OS</p>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
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

        {/* Admin link — only shown when user has admin_users permission */}
        {isAdmin && (
          <>
            <div className="my-2 border-t border-white/10" />
            <Link
              href="/dashboard/admin"
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
