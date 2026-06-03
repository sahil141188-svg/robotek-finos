"use server";

/**
 * Phone-audit server actions.
 *
 * After the 2026-06-03 incident (SRMC's owner received a message
 * addressed to "Ashish Sachdev" because of a wrong phone-to-customer
 * mapping in the bulk-uploaded contacts sheet), we require every
 * customer's phone to be HUMAN-VERIFIED before it can be included in
 * bulk WhatsApp sends.
 *
 * State storage:
 *   app_settings.phone_audit.value = {
 *     verified: {
 *       <customerId>: { phone: "...", verified_at: ISO, verified_by: <userId> }
 *     }
 *   }
 *
 * The verification is bound to a SPECIFIC phone string — if the phone is
 * later edited, the verified record no longer matches and the customer
 * reverts to "unverified".
 */

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type VerifiedEntry = {
  phone:        string;
  verified_at:  string;
  verified_by?: string;
};

export type PhoneAuditState = {
  verified: Record<string, VerifiedEntry>;
};

export async function getPhoneAudit(): Promise<PhoneAuditState> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("app_settings").select("value").eq("key", "phone_audit").maybeSingle();
  return (data?.value as PhoneAuditState) ?? { verified: {} };
}

async function savePhoneAudit(next: PhoneAuditState): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("app_settings").upsert(
    { key: "phone_audit", value: next, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

/**
 * Mark a single customer's CURRENT phone as verified.
 * The phone string is captured at verify-time; subsequent edits invalidate.
 */
export async function verifyCustomerPhone(
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated" };

  // Pull the live phone — we record exactly what's verified
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cust } = await (supabase as any)
    .from("customers").select("id, phone").eq("id", customerId).maybeSingle();
  if (!cust) return { ok: false, error: "Customer not found" };
  if (!cust.phone || !String(cust.phone).trim()) {
    return { ok: false, error: "Customer has no phone to verify" };
  }

  const state = await getPhoneAudit();
  state.verified[customerId] = {
    phone:        String(cust.phone).trim(),
    verified_at:  new Date().toISOString(),
    verified_by:  user.id,
  };
  await savePhoneAudit(state);
  revalidatePath("/dashboard/reminders/phone-audit");
  revalidatePath("/dashboard/reminders");
  return { ok: true };
}

/** Reverse a verification (e.g. operator changed their mind). */
export async function unverifyCustomerPhone(
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const state = await getPhoneAudit();
  delete state.verified[customerId];
  await savePhoneAudit(state);
  revalidatePath("/dashboard/reminders/phone-audit");
  revalidatePath("/dashboard/reminders");
  return { ok: true };
}

/** Verify every customer in one shot — use after a high-confidence audit. */
export async function bulkVerifyPhones(
  customerIds: string[],
): Promise<{ ok: boolean; verifiedCount: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, verifiedCount: 0, error: "Not authenticated" };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows } = await (supabase as any)
    .from("customers").select("id, phone").in("id", customerIds);

  const state = await getPhoneAudit();
  const now = new Date().toISOString();
  let count = 0;
  for (const r of (rows ?? []) as Array<{ id: string; phone: string | null }>) {
    if (!r.phone || !String(r.phone).trim()) continue;
    state.verified[r.id] = {
      phone:        String(r.phone).trim(),
      verified_at:  now,
      verified_by:  user.id,
    };
    count++;
  }
  await savePhoneAudit(state);
  revalidatePath("/dashboard/reminders/phone-audit");
  revalidatePath("/dashboard/reminders");
  return { ok: true, verifiedCount: count };
}
