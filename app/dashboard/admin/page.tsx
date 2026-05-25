import { requireAuth } from "@/lib/auth";
import { getAllUsers } from "@/app/actions/users";
import { getCompanies } from "@/app/actions/companies";
import { Header } from "@/components/layout/header";
import { UserTable } from "@/components/admin/user-table";
import { AddUserSheet } from "@/components/admin/add-user-sheet";
import { CompaniesSection } from "@/components/admin/companies-section";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, Settings } from "lucide-react";

/**
 * Admin Panel — CEO only.
 * Lists all users with their roles, status, and permissions.
 * Provides create user (invite) and edit user functionality.
 */
export default async function AdminPage() {
  const { profile } = await requireAuth();

  // Only CEO can access the admin panel
  if (profile.role !== "ceo") redirect("/dashboard");

  const [users, companies] = await Promise.all([getAllUsers(), getCompanies()]);

  return (
    <>
      <Header
        title="Admin Panel"
        breadcrumbs={[{ label: "Admin" }]}
        showImport={false}
      />
      <main className="flex-1 p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Users</p>
            <p className="text-2xl font-bold text-brand-black">{users.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground mb-1">Active</p>
            <p className="text-2xl font-bold text-green-700">
              {users.filter((u) => u.is_active).length}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-white p-4">
            <p className="text-xs text-muted-foreground mb-1">Inactive</p>
            <p className="text-2xl font-bold text-muted-foreground">
              {users.filter((u) => !u.is_active).length}
            </p>
          </div>
        </div>

        {/* Users table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-red" />
              <h2 className="font-semibold text-brand-black">All Users</h2>
              <span className="text-xs text-muted-foreground">
                ({users.length})
              </span>
            </div>

            {/* Bug #7 fix: AddUserSheet is a client component that closes itself on success */}
            <AddUserSheet />
          </div>

          <UserTable users={users} />
        </div>

        {/* ── Companies ───────────────────────────────────────────────── */}
        <CompaniesSection initialCompanies={companies} />

        {/* Notification settings shortcut */}
        <div className="flex justify-end">
          <Link
            href="/dashboard/admin/settings"
            className="inline-flex items-center gap-2 text-sm text-brand-gray-mid hover:text-brand-black transition-colors"
          >
            <Settings className="w-4 h-4" />
            Notification &amp; Reminder Settings
          </Link>
        </div>

        {/* Service key notice */}
        {!process.env.SUPABASE_SERVICE_ROLE_KEY && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <strong>⚠️ Service role key missing.</strong> To invite users, add{" "}
            <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to{" "}
            <code className="bg-amber-100 px-1 rounded">.env.local</code>. Find it in{" "}
            <a
              href="https://supabase.com/dashboard/project/huvoohwtexhtadmuedno/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Supabase → Settings → API → service_role key
            </a>
            .
          </div>
        )}
      </main>
    </>
  );
}
