/**
 * Sales OS — Quotation detail (printable + status + WhatsApp).
 */
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/header";
import { getQuoteDetail } from "@/lib/crm/quotes";
import { QuoteView } from "@/components/crm/quote-view";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getQuoteDetail(id);
  if (!detail) notFound();

  return (
    <>
      <Header
        title={detail.quote.quote_number}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Quotations", href: "/dashboard/sales-os/quotes" },
          { label: detail.quote.quote_number },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <QuoteView detail={detail} />
      </main>
    </>
  );
}
