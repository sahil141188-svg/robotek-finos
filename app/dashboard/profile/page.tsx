import { requireAuth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { ProfileForm } from "@/components/profile/profile-form";

/**
 * User Profile — any logged-in user.
 * Update display name, WhatsApp number, and notification preferences.
 */
export default async function ProfilePage() {
  const { profile } = await requireAuth();

  return (
    <>
      <Header
        title="My Profile"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "My Profile" },
        ]}
        showImport={false}
      />
      <main className="flex-1 p-4 sm:p-6 max-w-xl">
        <ProfileForm profile={profile} />
      </main>
    </>
  );
}
