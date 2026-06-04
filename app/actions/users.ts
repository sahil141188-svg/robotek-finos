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
  // Allow CEO role OR admin_users permission (in case role hasn't synced in JWT)
  const isAdmin = profile?.permissions?.admin_users === true;
  if (!profile || (profile.role !== "ceo" && !isAdmin)) {
    console.error("[assertCEO] blocked — role:", profile?.role, "admin_users:", isAdmin);
    throw new Error("Only the CEO can manage users. Make sure you are logged in as CEO.");
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
  // Optional sales-team assignment (NBD/CRR + role like sales_coordinator)
  const crmDepartment = (formData.get("crm_department") as string) || null;
  const crmTeamRole   = (formData.get("crm_team_role") as string) || null;

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

  // Bug #1 fix: use admin client (service role) to upsert the profile row.
  // createClient() is RLS-bound to the CEO's session — the INSERT targets a
  // different user's UUID (not auth.uid()), so RLS silently rejects it and the
  // new user ends up with no profile row.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (admin as any)
    .from("users")
    .upsert({
      id: data.user.id,
      email,
      full_name,
      role,
      permissions,
      is_active: true,
      crm_department: crmDepartment,
      crm_team_role: crmTeamRole,
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

  // Bug #2 fix: same RLS issue as Bug #1 — must use admin client for foreign UUID upsert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (admin as any).from("users").upsert({
    id:         data.user.id,
    email,
    full_name,
    role,
    permissions,
    is_active:  true,
  });

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
    email?: string;
    crm_department?: string | null;
    crm_team_role?: string | null;
  }
) {
  await assertCEO();

  // Bug #3 fix: must use admin client (service role) here.
  // createClient() is RLS-bound to the CEO session — the UPDATE targets a
  // *different* user's UUID so RLS silently updates 0 rows without returning
  // an error.  The action appeared to succeed (no throw) but the DB row was
  // never changed — that is why role/permission edits showed "Updated ✓" but
  // reverted instantly on refresh.
  const admin = getAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
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
// Delete a user (CEO only)
// Removes from Supabase Auth AND the public.users profile table.
// ─────────────────────────────────────────────────────────
export async function deleteUser(
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  await assertCEO();
  const admin = getAdminClient();

  // Delete from Supabase Auth (this is authoritative)
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) return { success: false, error: authError.message };

  // Bug #4 fix: await and check the profile row delete — was fire-and-forget.
  // If this fails (FK constraint), stale profile row stays and user reappears.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileDeleteErr } = await (admin as any).from("users").delete().eq("id", userId);
  if (profileDeleteErr) {
    console.error("[deleteUser] profile row delete failed:", profileDeleteErr.message);
    // Non-fatal: auth account is gone so user cannot log in — continue.
  }

  revalidatePath("/dashboard/admin");
  return { success: true };
}

// ─────────────────────────────────────────────────────────
// Toggle active / inactive
// ─────────────────────────────────────────────────────────
export async function toggleUserActive(userId: string, isActive: boolean) {
  await assertCEO();

  // Bug #3 (extended): use admin client — RLS blocks updating other users' rows
  const admin = getAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from("users")
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
//
// Strategy: use auth.admin.listUsers() as the source of truth
// (every account ever created), then merge with public.users
// profile rows.  This way users who were added via the Supabase
// dashboard (or whose trigger-created profile row failed) are
// always visible.
// ─────────────────────────────────────────────────────────
export async function getAllUsers(): Promise<UserRow[]> {
  await assertCEO();
  const admin = getAdminClient();

  // 1. Auth users — canonical list; no RLS, no missing rows
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    perPage: 1000,
  });
  if (authErr) throw new Error(authErr.message);
  const authUsers = authData?.users ?? [];

  // 2. Profile rows — bypass RLS via service-role client
  const { data: profileRows, error: profileErr } = await admin
    .from("users")
    .select("*")
    .order("created_at", { ascending: true });
  if (profileErr) throw new Error(profileErr.message);

  // 3. Build lookup map  id → profile
  const profileMap = new Map<string, UserRow>(
    ((profileRows ?? []) as UserRow[]).map((p) => [p.id, p])
  );

  // 4. Merge: prefer existing profile; synthesise one for orphaned auth users
  return authUsers.map((authUser) => {
    const profile = profileMap.get(authUser.id);
    if (profile) return profile;

    // Auth account exists but public.users row is missing.
    // Build a synthetic row from auth metadata so they appear in the table
    // and can be edited/assigned a real profile via the Edit sheet.
    const role = ((authUser.app_metadata?.role as UserRole | undefined) ?? "accounts");
    return {
      id:              authUser.id,
      email:           authUser.email ?? "",
      full_name:       (authUser.user_metadata?.full_name as string | undefined)
                         ?? authUser.email
                         ?? "Unknown",
      role,
      permissions:     DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS["accounts"],
      is_active:       authUser.banned_until == null,
      created_at:      authUser.created_at,
      updated_at:      authUser.updated_at ?? authUser.created_at,
      whatsapp_number: null,
      notify_whatsapp: false,
      notify_email:    true,
    } as UserRow;
  });
}
