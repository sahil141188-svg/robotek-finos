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
// Create a new user directly with email + password (no invite email)
// Admin sets the credentials; user logs in immediately.
// ─────────────────────────────────────────────────────────
export async function createUserWithPassword(formData: FormData) {
  await assertCEO();
  const admin = getAdminClient();

  const email     = formData.get("email")     as string;
  const password  = formData.get("password")  as string;
  const full_name = formData.get("full_name") as string;
  const role      = formData.get("role")      as UserRole;
  const permissionsRaw = formData.get("permissions") as string | null;
  const permissions = permissionsRaw
    ? (JSON.parse(permissionsRaw) as UserPermissions)
    : DEFAULT_PERMISSIONS[role];

  // Create auth user with password; mark email as confirmed so they can log in immediately
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error) throw new Error(error.message);

  // Set role in app_metadata (JWT-safe; not user-editable)
  await admin.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role },
  });

  // Upsert the profile row (the trigger may have already created it)
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (supabase as any)
    .from("users")
    .upsert({
      id: data.user.id,
      email,
      full_name,
      role,
      permissions,
      is_active: true,
    });

  if (profileError) throw new Error(profileError.message);

  revalidatePath("/dashboard/admin");
}

// ─────────────────────────────────────────────────────────
// Invite a new user (kept for backwards compatibility)
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
// Update the currently logged-in user's own profile
// (any authenticated user — not CEO-only)
// ─────────────────────────────────────────────────────────
export async function updateProfile(updates: {
  full_name?:        string;
  whatsapp_number?:  string | null;
  notify_whatsapp?:  boolean;
  notify_email?:     boolean;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("users")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

// ─────────────────────────────────────────────────────────
// Fetch team users for task-assignment dropdowns (any auth)
// ─────────────────────────────────────────────────────────
export type TeamUser = {
  id:        string;
  full_name: string;
  role:      string;
  email:     string;
};

export async function getTeamUsers(): Promise<TeamUser[]> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("users")
    .select("id, full_name, role, email")
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("full_name", { ascending: true }) as {
      data: TeamUser[] | null;
      error: { message: string } | null;
    };
  if (error || !data) return [];
  return data;
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
