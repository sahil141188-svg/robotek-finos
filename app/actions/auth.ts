"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Server action: sign in with email + password.
 * The server client sets the session cookies directly in the response,
 * so no client → server cookie handoff is needed.
 */
export async function signIn(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const email    = formData.get("email")    as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  // Bust the RSC cache so the new session is visible to Server Components
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/**
 * Server action: sign out.
 */
export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
