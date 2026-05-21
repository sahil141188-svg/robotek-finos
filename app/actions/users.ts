"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { Database, UserPermissions, UserRole } from "@/types/database";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/** Gets a Supabase admin client (service role) for user management. */
function getAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local to manage users."
    );
  }
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Asserts the current session belongs to a CEO (only CEOs can manage users). */
async function assertCEO(): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data } = await supabase
    .from("users")
    .select("role, permissions")
    .eq("id", user.id)
    .single();

  const profile = data as Pick<UserRow, "role" | "permissions"> | null;
  if (!profile || profile.role !== "ceo") {
    throw new Error("Only the CEO can manage users.");
  }
  return user.id;
}

// ─────────────────────────────────────────────────────────
// Invite a new user
// ─────────────────────────────────────────────────────────
export async function inviteUser(formData: FormData) {
  await assertCEO();
  const admin = getAdminClient();

  const email = formData.get("email") as string;
  const full_name = formData.get("full_name") as string;
  const role = formData.get("role") as UserRole;
  const permissions = DEFAULT_PERMISSIONS[role];

  // Invite via Supabase Auth — sends an email invite to the user
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  });

  if (error) throw new Error(error.message);

  // Set role in app_metadata (JWT-safe; not user-editable)
  await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  // Upsert the profile row (the trigger may have already created it)
  const supabase = await createClient();
  const { error: profileError } = await supabase
    .from("users")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .upsert({
      id: data.user.id,
      email,
      full_name,
      role,
      permissions,
      is_active: true,
    } as unknown as any);

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/dashboard/admin");
}

// ─────────────────────────────────────────────────────────
// Update an existing user's profile + permissions
// ─────────────────────────────────────────────────────────
export async function updateUser(
  userId: string,
  updates: {
    full_name?: string;
    role?: UserRole;
    is_active?: boolean;
    permissions?: UserPermissions;
  }
) {
  await assertCEO();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  // If role changed, sync app_metadata so JWT reflects new role
  if (updates.role) {
    const admin = getAdminClient();
    await admin.auth.admin.updateUserById(userId, {
      app_metadata: { role: updates.role },
    });
  }

  revalidatePath("/dashboard/admin");
}

// ─────────────────────────────────────────────────────────
// Toggle active / inactive
// ─────────────────────────────────────────────────────────
export async function toggleUserActive(userId: string, isActive: boolean) {
  await assertCEO();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("users") as any)
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/admin");
}

// ─────────────────────────────────────────────────────────
// Fetch all users (server action for the admin table)
// ─────────────────────────────────────────────────────────
export async function getAllUsers(): Promise<UserRow[]> {
  await assertCEO();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, email, full_name, role, is_active, permissions, created_at, updated_at, whatsapp_number, notify_whatsapp, notify_email")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as UserRow[];
}
