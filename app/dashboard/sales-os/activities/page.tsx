/**
 * Sales OS — Follow-ups cockpit.
 * The NBD SC's command center for the new-customer journey: every pending
 * follow-up bucketed by Overdue / Today / Upcoming, filterable by department
 * and owner. "Done + next" keeps the follow-up chain unbroken.
 */
import { Header } from "@/components/layout/header";
import { requireAuth } from "@/lib/auth";
import { getFollowups, getAccounts, getDeals, getSalesTeam } from "@/lib/crm/queries";
import { FollowupsClient } from "@/components/crm/followups-client";

export const dynamic = "force-dynamic";

export default async function FollowupsPage() {
  const { profile } = await requireAuth();
  const [items, accounts, deals, sales] = await Promise.all([
    getFollowups(),
    getAccounts(),
    getDeals(),
    getSalesTeam(),
  ]);

  const openDeals = deals
    .filter((d) => d.stage !== "won" && d.stage !== "lost")
    .map((d) => ({ id: d.id, title: d.title }));

  return (
    <>
      <Header
        title="Follow-ups"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Follow-ups" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-4xl">
        <FollowupsClient
          items={items}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          deals={openDeals}
          sales={sales}
          currentUserId={profile.id}
        />
      </main>
    </>
  );
}
