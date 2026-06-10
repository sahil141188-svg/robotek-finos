/**
 * NBD — Deal (Opportunity) detail Form view: stage bar, priority, fields,
 * activities, and chatter timeline.
 */
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getDealDetail, getLostReasons } from "@/lib/crm/detail";
import { DealDetailView } from "@/components/crm/deal-detail";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detail, lostReasons] = await Promise.all([getDealDetail(id), getLostReasons()]);
  if (!detail) notFound();

  return (
    <>
      <Header
        title={detail.deal.title}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Pipeline", href: "/dashboard/sales-os/pipeline" },
          { label: detail.deal.title },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-4xl">
        <DealDetailView detail={detail} lostReasons={lostReasons} />
      </main>
    </>
  );
}
