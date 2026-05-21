import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dir, "../.env.local") });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

console.log("1️⃣  Attempting to create auth user…");
const { data, error } = await admin.auth.admin.createUser({
  email: "sahil141188@gmail.com",
  password: "Robotek@2024",
  email_confirm: true,
  user_metadata: { full_name: "Sahil Aggarwal" },
  app_metadata: { role: "ceo" },
});

if (error) {
  console.log("❌  createUser error:", JSON.stringify(error, null, 2));

  // Trigger still failing — manually insert the profile without the trigger
  console.log("\n2️⃣  Trying inviteUserByEmail as fallback…");
  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(
    "sahil141188@gmail.com",
    { data: { full_name: "Sahil Aggarwal" } }
  );
  if (invErr) {
    console.log("❌  inviteUser error:", invErr.message);
  } else {
    console.log("✅  Invite sent! User ID:", inv.user.id);
    await admin.auth.admin.updateUserById(inv.user.id, {
      app_metadata: { role: "ceo" },
    });
    // Manually upsert profile
    const { error: pErr } = await admin.from("users").upsert({
      id: inv.user.id,
      email: "sahil141188@gmail.com",
      full_name: "Sahil Aggarwal",
      role: "ceo",
      is_active: true,
      permissions: {
        view_dashboard: true, import_data: true, view_compliance: true,
        manage_tasks: true, view_payables: true, view_receivables: true,
        view_review: true, view_alerts: true, admin_users: true,
      },
    });
    if (pErr) console.log("Profile upsert error:", pErr.message);
    else console.log("✅  Profile row inserted. Check your email for the invite link.");
  }
} else {
  console.log("✅  Auth user created:", data.user.id);

  // Manually upsert profile in case trigger didn't fire
  const { error: pErr } = await admin.from("users").upsert({
    id: data.user.id,
    email: "sahil141188@gmail.com",
    full_name: "Sahil Aggarwal",
    role: "ceo",
    is_active: true,
    permissions: {
      view_dashboard: true, import_data: true, view_compliance: true,
      manage_tasks: true, view_payables: true, view_receivables: true,
      view_review: true, view_alerts: true, admin_users: true,
    },
  });
  if (pErr) console.log("⚠️  Profile upsert error:", pErr.message);
  else console.log("✅  Profile row inserted.");

  console.log("\n🎉  All done!");
  console.log("    URL:      http://localhost:3000");
  console.log("    Email:    sahil141188@gmail.com");
  console.log("    Password: Robotek@2024");
}

// Final verification
const { data: users } = await admin.from("users").select("id, email, role, permissions");
console.log("\n📋  Public users table:", JSON.stringify(users, null, 2));

const { data: auth } = await admin.auth.admin.listUsers();
console.log("🔐  Auth users:", auth?.users?.map(u => u.email + " | confirmed: " + u.email_confirmed_at));
