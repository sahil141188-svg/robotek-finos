import { requireAuth } from "@/lib/auth";
import { getCompanies } from "@/app/actions/companies";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { COMPANIES } from "@/lib/companies-data";

/**
 * Root layout for all authenticated /dashboard routes.
 * Fetches the user profile AND the company list server-side.
 * Falls back to the static COMPANIES array if the DB table is empty
 * (before the Supabase migration has been run).
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

  return (
    <DashboardShell profile={profile} companies={companies}>
      {children}
    </DashboardShell>
  );
}
