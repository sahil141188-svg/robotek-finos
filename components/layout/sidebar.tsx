"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/database";
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
} from "lucide-react";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "CFO Dashboard",
    icon: LayoutDashboard,
    roles: ["ceo", "cfo", "coo", "accounts", "ca"] as UserRole[],
  },
  {
    href: "/dashboard/import",
    label: "Import Data",
    icon: Upload,
    roles: ["ceo", "cfo", "accounts"] as UserRole[],
  },
  {
    href: "/dashboard/compliance",
    label: "Compliance Calendar",
    icon: CalendarCheck,
    roles: ["ceo", "cfo", "coo", "accounts", "ca"] as UserRole[],
  },
  {
    href: "/dashboard/tasks",
    label: "Task Management",
    icon: CheckSquare,
    roles: ["ceo", "cfo", "coo", "accounts", "ca"] as UserRole[],
  },
  {
    href: "/dashboard/payables",
    label: "Accounts Payable",
    icon: TrendingDown,
    roles: ["ceo", "cfo", "coo", "accounts"] as UserRole[],
  },
  {
    href: "/dashboard/receivables",
    label: "Accounts Receivable",
    icon: TrendingUp,
    roles: ["ceo", "cfo", "coo", "accounts"] as UserRole[],
  },
  {
    href: "/dashboard/review",
    label: "Review Engine",
    icon: FileText,
    roles: ["ceo", "cfo"] as UserRole[],
  },
  {
    href: "/dashboard/alerts",
    label: "Alerts",
    icon: Bell,
    roles: ["ceo", "cfo", "coo", "accounts", "ca"] as UserRole[],
  },
];

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  userEmail: string;
}

export function Sidebar({ userRole, userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(userRole)
  );

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
      <nav className="flex-1 p-4 space-y-1">
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
      </nav>

      {/* User profile + sign out */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand-red flex items-center justify-center">
            <span className="text-white text-xs font-bold uppercase">
              {userName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">{userName}</p>
            <p className="text-white/50 text-xs truncate">{ROLE_LABELS[userRole]}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-white/60 hover:text-white text-xs transition-colors w-full"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
