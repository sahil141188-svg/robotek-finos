/**
 * Sales OS — Leads (NBD intake).
 * Capture inbound enquiries, assign to sales team, qualify, and convert
 * a qualified lead into an account + opening deal (start of the NBD pipeline).
 */
import { Header } from "@/components/layout/header";
import { getLeads, getSalesTeam, getNextFollowupDates } from "@/lib/crm/queries";
import { getMeetingTargets, getSuperStockists } from "@/lib/crm/meetings";
import { LeadsClient } from "@/components/crm/leads-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const [leads, sales, followups, meetingTargets, superStockists] = await Promise.all([
    getLeads(),
    getSalesTeam(),
    getNextFollowupDates(),
    getMeetingTargets(),
    getSuperStockists(),
  ]);

  return (
    <>
      <Header
        title="Leads"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Leads" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-6xl">
        <LeadsClient leads={leads} sales={sales} nextFollowups={followups.byLead} meetingTargets={meetingTargets} superStockists={superStockists} />
      </main>
    </>
  );
}
