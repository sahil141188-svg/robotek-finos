/**
 * Sales OS — Products catalog. Master list used to build quotations.
 */
import { Header } from "@/components/layout/header";
import { getProducts } from "@/lib/crm/quotes";
import { ProductsClient } from "@/components/crm/products-client";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const products = await getProducts();
  return (
    <>
      <Header
        title="Products"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Products" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-5xl">
        <ProductsClient products={products} />
      </main>
    </>
  );
}
