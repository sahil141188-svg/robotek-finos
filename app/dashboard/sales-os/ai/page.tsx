/**
 * Sales OS — AI Sales Coach.
 * Helps the SC act: a prioritized "do now" plan from live pipeline state,
 * AI-drafted WhatsApp replies to enquiries, and objection-handling responses.
 */
import { Header } from "@/components/layout/header";
import { getLeads } from "@/lib/crm/queries";
import { AiCoach } from "@/components/crm/ai-coach";

export const dynamic = "force-dynamic";

export default async function AiCoachPage() {
  const leads = await getLeads();

  return (
    <>
      <Header
        title="AI Sales Coach"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "AI Coach" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-3xl">
        <AiCoach
          leads={leads.map((l) => ({
            id: l.id,
            name: l.name,
            company: l.company,
            phone: l.phone,
            lead_type: l.lead_type,
          }))}
        />
      </main>
    </>
  );
}
