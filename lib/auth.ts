import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Returns the current authenticated user profile, or redirects to /login.
 * Server-only — do NOT import in client components.
 */
export async function requireAuth(): Promise<{ user: { id: string; email?: string }; profile: UserRow }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  return { user, profile: profile as UserRow };
}

/**
 * Returns the current user profile without redirecting (nullable).
 * Server-only — do NOT import in client components.
 */
export async function getAuth(): Promise<UserRow | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ? (profile as UserRow) : null;
}
