import { requireAuth } from "@/lib/auth";
import { getAllUsers } from "@/app/actions/users";
import { Header } from "@/components/layout/header";
import { UserTable } from "@/components/admin/user-table";
import { UserForm } from "@/components/admin/user-form";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { redirect } from "next/navigation";
import { UserPlus, Users } from "lucide-react";

/**
 * Admin Panel — CEO only.
 * Lists all users with their roles, status, and permissions.
 * Provides create user (invite) and edit user functionality.
 */
export default async function AdminPage() {
  const { profile } = await requireAuth();

  // Only CEO can access the admin panel
  if (profile.role !== "ceo") redirect("/dashboard");

  const users = await getAllUsers();

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

            {/* Invite user — opens a sheet */}
            <Sheet>
              <SheetTrigger
                render={
                  <button className="inline-flex items-center gap-2 h-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium bg-brand-red hover:bg-brand-maroon text-white transition-colors">
                    <UserPlus className="w-3.5 h-3.5" />
                    Invite User
                  </button>
                }
              />
              <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle>Invite New User</SheetTitle>
                  <SheetDescription>
                    Enter the user's details and set their module permissions. They will receive an
                    email invitation to set their password.
                  </SheetDescription>
                </SheetHeader>
                <UserForm />
              </SheetContent>
            </Sheet>
          </div>

          <UserTable users={users} />
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
