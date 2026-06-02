/**
 * Sales OS — Accounts.
 * Dealers / distributors / retailers across both departments. Filter by
 * NBD (new) vs CRR (retained). Each row drills into the account detail.
 */
import { Header } from "@/components/layout/header";
import { getAccounts, getSalesTeam } from "@/lib/crm/queries";
import { AccountsClient } from "@/components/crm/accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const [accounts, sales] = await Promise.all([getAccounts(), getSalesTeam()]);

  return (
    <>
      <Header
        title="Accounts"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales OS", href: "/dashboard/sales-os" },
          { label: "Accounts" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-6 max-w-6xl">
        <AccountsClient accounts={accounts} sales={sales} />
      </main>
    </>
  );
}
