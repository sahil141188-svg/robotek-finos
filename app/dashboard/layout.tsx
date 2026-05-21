import { requireAuth } from "@/lib/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * Root layout for all authenticated /dashboard routes.
 * Fetches the user profile server-side and passes it to DashboardShell.
 * DashboardShell provides SidebarContext for mobile nav + renders Sidebar.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  return (
    <DashboardShell profile={profile}>
      {children}
    </DashboardShell>
  );
}
