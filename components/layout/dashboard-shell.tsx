"use client";

/**
 * DashboardShell — Client wrapper for the dashboard layout.
 * Provides SidebarContext so both Sidebar and Header can share open/close state.
 * Renders the mobile overlay backdrop when sidebar is open.
 */

import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "./sidebar";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { CompanyProvider } from "./company-context";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

export function DashboardShell({
  profile,
  children,
}: {
  profile:  UserRow;
  children: React.ReactNode;
}) {
  return (
    <CompanyProvider>
      <SidebarProvider>
        <ShellInner profile={profile}>{children}</ShellInner>
      </SidebarProvider>
    </CompanyProvider>
  );
}

function ShellInner({ profile, children }: { profile: UserRow; children: React.ReactNode }) {
  const { isOpen, close } = useSidebar();

  return (
    <div className="flex min-h-screen bg-brand-gray-light">
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-20 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      <Sidebar profile={profile} />

      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {children}
      </div>

      <Toaster position="top-right" richColors />
    </div>
  );
}
