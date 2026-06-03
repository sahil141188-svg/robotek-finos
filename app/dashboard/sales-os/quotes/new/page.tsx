/**
 * Sales OS — New Quotation (CPQ builder).
 */
import { Header } from "@/components/layout/header";
import { getQuoteFormData } from "@/lib/crm/quotes";
import { QuoteBuilder } from "@/components/crm/quote-builder";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  const { products, accounts } = await getQuoteFormData();
  return (
    <>
      <Header
        title="New Quotation"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "NBD", href: "/dashboard/sales-os" },
          { label: "Quotations", href: "/dashboard/sales-os/quotes" },
          { label: "New" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <QuoteBuilder products={products} accounts={accounts} />
      </main>
    </>
  );
}
