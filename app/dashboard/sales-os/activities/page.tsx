/**
 * Sales OS — Activities & follow-ups across all accounts/deals.
 * Open items first, completed below. Log new calls/visits/follow-ups inline.
 */
import { Header } from "@/components/layout/header";
import { getActivities, getAccounts, getSalesTeam } from "@/lib/crm/queries";
import { ActivitiesClient } from "@/components/crm/activities-client";

export const dynamic = "force-dynamic";

export default async function ActivitiesPage() {
  const [activities, accounts, sales] = await Promise.all([
    getActivities(),
    getAccounts(),
    getSalesTeam(),
  ]);

  return (
    <>
      <Header
        title="Activities"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Activities" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-4xl">
        <ActivitiesClient
          activities={activities}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          sales={sales}
        />
      </main>
    </>
  );
}
