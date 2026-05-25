import { requireAuth } from "@/lib/auth";
import { getCompanies } from "@/app/actions/companies";
import { getSelectedCompanyId } from "@/lib/company-cookie";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { GlobalAlerts } from "@/components/layout/global-alerts";
import { COMPANIES } from "@/lib/companies-data";

/**
 * Root layout for all authenticated /dashboard routes.
 * Fetches the user profile AND the company list server-side.
 * Falls back to the static COMPANIES array if the DB table is empty.
 *
 * Reads the selected_company_id cookie so the server-rendered
 * CompanySwitcher and the client-hydrated version start in sync
 * (eliminates hydration mismatch).
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  // Fetch companies from DB; fall back to the static list if the table is empty
  const dbCompanies = await getCompanies();
  const companies   = dbCompanies.length > 0 ? dbCompanies : COMPANIES;

  // Read cookie so server and client agree on the initial company.
  // null = "All Companies", or a specific company UUID.
  const cookieCompanyId  = await getSelectedCompanyId();
  // Validate: the stored UUID must exist in the current company list.
  const initialCompanyId = cookieCompanyId && companies.find((c) => c.id === cookieCompanyId)
    ? cookieCompanyId
    : (companies[0]?.id ?? null);

  return (
    <DashboardShell
      profile={profile}
      companies={companies}
      initialCompanyId={initialCompanyId}
    >
      <GlobalAlerts />
      {children}
    </DashboardShell>
  );
}
