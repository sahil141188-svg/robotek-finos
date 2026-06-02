/**
 * Sales OS — Pipeline (Kanban).
 * Both departments' deals across stages New → Qualified → Quoted →
 * Negotiation → Won/Lost. Marking a deal "Won" auto-hands its account
 * to the CRR team (handled by the DB trigger).
 */
import { Header } from "@/components/layout/header";
import { getDeals, getAccounts, getSalesTeam } from "@/lib/crm/queries";
import { PipelineBoard } from "@/components/crm/pipeline-board";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [deals, accounts, sales] = await Promise.all([
    getDeals(),
    getAccounts(),
    getSalesTeam(),
  ]);

  return (
    <>
      <Header
        title="Pipeline"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Pipeline" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-[1400px]">
        <PipelineBoard
          deals={deals}
          accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
          sales={sales}
        />
      </main>
    </>
  );
}
