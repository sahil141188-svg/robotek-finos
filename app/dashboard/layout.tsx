import { requireAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

/**
 * Root layout for all authenticated /dashboard routes.
 * Fetches the user profile server-side and passes role to the sidebar.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();

  return (
    <div className="flex min-h-screen bg-brand-gray-light">
      <Sidebar
        userRole={profile.role}
        userName={profile.full_name}
        userEmail={profile.email}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
