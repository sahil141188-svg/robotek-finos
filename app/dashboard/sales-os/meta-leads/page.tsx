/**
 * Meta Leads page — aggregates leads from Meta (Facebook/Instagram) ads.
 * Covers:
 *   • Click-to-WhatsApp ads (source = "Meta WhatsApp") — manual quick-add
 *   • Meta Lead Form ads (source = "Meta Lead Form") — auto-captured via webhook
 */
import { Header } from "@/components/layout/header";
import { getMetaLeads, getSalesTeam } from "@/lib/crm/meta-leads";
import { MetaLeadsClient } from "@/components/crm/meta-leads-client";

export const dynamic = "force-dynamic";

export default async function MetaLeadsPage() {
  const [leads, sales] = await Promise.all([getMetaLeads(), getSalesTeam()]);

  return (
    <>
      <Header
        title="Meta Leads"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Meta Leads" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-6xl">
        <MetaLeadsClient leads={leads} sales={sales} />
      </main>
    </>
  );
}
