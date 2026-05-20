import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { CFODashboardClient } from "@/components/dashboard/cfo-dashboard-client";

/**
 * CFO Dashboard — Module 1 (Day 2).
 * Server component: fetches auth, passes role to client dashboard.
 */
export default async function DashboardPage() {
    const { profile } = await requireAuth();

  return (
        <>
              <Header
                        title="CFO Dashboard"
                        breadcrumbs={[{ label: "Dashboard" }]}
                        showImport={true}
                        importModule="transactions"
                      />
              <main className="flex-1 p-6 bg-[#0D0B0C] min-h-screen">
                      <CFODashboardClient userRole={profile.role} userName={profile.full_name} />
              </main>main>
        </>>
      );
}</>
