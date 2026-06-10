/**
 * NBD — Lead detail Form view: all enquiry fields, priority, activities,
 * and chatter timeline.
 */
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getLeadDetail } from "@/lib/crm/detail";
import { LeadDetailView } from "@/components/crm/lead-detail";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getLeadDetail(id);
  if (!detail) notFound();

  return (
    <>
      <Header
        title={detail.lead.name}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Leads", href: "/dashboard/sales-os/leads" },
          { label: detail.lead.name },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-4xl">
        <LeadDetailView detail={detail} />
      </main>
    </>
  );
}
