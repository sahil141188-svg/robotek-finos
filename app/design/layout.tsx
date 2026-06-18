/**
 * Designer Portal layout — lightweight shell for Vishal, Nitin & Sarthak.
 * No finance sidebar. Just Design OS tasks.
 */
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DesignPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/design/login");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: profile } = await db.from("users").select("full_name, role").eq("id", user.id).single();

  const allowed = ["designer", "reviewer", "ceo", "coo", "cfo", "accounts", "ca"];
  if (profile && !allowed.includes(profile.role)) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E52D31] flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          <div>
            <span className="font-bold text-gray-900 text-sm">Design OS</span>
            <span className="text-xs text-gray-500 ml-2">Robotek India</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <span className="text-sm text-gray-600 font-medium">{profile.full_name}</span>
          )}
          <form action="/api/design/signout" method="POST">
            <button type="submit" className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded border border-gray-200 hover:border-gray-400 transition-colors">
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-4xl mx-auto p-4 sm:p-6">{children}</main>
    </div>
  );
}
