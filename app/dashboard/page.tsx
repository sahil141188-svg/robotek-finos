import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { ROLE_LABELS } from "@/lib/roles";

/**
 * CFO Dashboard — Module 1 (coming in Day 2).
 * Shows a role-appropriate welcome message until the full dashboard is built.
 */
export default async function DashboardPage() {
  const { profile } = await requireAuth();

  return (
    <>
      <Header
        title="CFO Dashboard"
        breadcrumbs={[{ label: "Dashboard" }]}
        showImport={true}
        importModule="transactions"
      />
      <main className="flex-1 p-6">
        <div className="rounded-xl border border-border bg-white p-8 text-center space-y-3">
          <div className="w-14 h-14 rounded-xl bg-brand-red/10 flex items-center justify-center mx-auto">
            <span className="text-3xl">📊</span>
          </div>
          <h2 className="text-xl font-semibold text-brand-black">
            Welcome, {profile.full_name}
          </h2>
          <p className="text-brand-gray-mid text-sm">
            CFO Dashboard (Module 1) — coming on Day 2. Import your first data file to get started.
          </p>
          <p className="text-xs text-brand-gray-mid">
            Role: <span className="font-medium text-brand-red">{ROLE_LABELS[profile.role]}</span>
          </p>
        </div>
      </main>
    </>
  );
}
